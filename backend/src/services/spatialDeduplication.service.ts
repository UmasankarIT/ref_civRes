import { Pool, PoolClient } from 'pg';
import { PrioritizationEngine } from './prioritization.service';

export interface ReportSubmissionPayload {
  reporterId?: string | null;
  categoryId: string;
  title?: string;
  userComment?: string;
  longitude: number;
  latitude: number;
  gpsAccuracyMeters?: number;
  isOnSite: boolean;
  rawImageUrl: string;
  compressedImageUrl?: string;
  exifTimestamp?: Date | null;
  exifLongitude?: number | null;
  exifLatitude?: number | null;
  deviceInfo?: Record<string, unknown>;
  
  // From ML Vision Service
  mlCategory?: string;
  mlConfidence?: number;
  mlSeverityScore?: number; // 1.0 to 5.0
}

export interface SubmissionResult {
  isDuplicate: boolean;
  issueId: string;
  reportId: string;
  trackingNumber: string;
  distanceFromExistingMeters?: number;
  currentReportCount: number;
  updatedPriorityScore: number;
  status: string;
}

export class SpatialDeduplicationService {
  private static readonly SPATIAL_PROXIMITY_THRESHOLD_METERS = 25.0; // 20-30m window

  /**
   * Submits a report with spatial deduplication via PostGIS ST_DWithin.
   * Runs atomically inside a PostgreSQL transaction with pessimistic row locking (FOR UPDATE)
   * on the matched issue to prevent race conditions during concurrent reports.
   */
  public static async processReportSubmission(
    pool: Pool,
    payload: ReportSubmissionPayload
  ): Promise<SubmissionResult> {
    const client: PoolClient = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        reporterId = null,
        categoryId,
        title,
        userComment,
        longitude,
        latitude,
        gpsAccuracyMeters,
        isOnSite,
        rawImageUrl,
        compressedImageUrl,
        exifTimestamp,
        exifLongitude,
        exifLatitude,
        deviceInfo,
        mlCategory,
        mlConfidence,
        mlSeverityScore = 2.5
      } = payload;

      // 1. Check EXIF GPS vs User Claimed Location (Geodesic distance verification)
      let exifVerified = false;
      if (exifLongitude !== undefined && exifLongitude !== null && 
          exifLatitude !== undefined && exifLatitude !== null) {
        const exifCheckQuery = `
          SELECT ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
          ) AS exif_distance;
        `;
        const exifRes = await client.query(exifCheckQuery, [
          longitude,
          latitude,
          exifLongitude,
          exifLatitude
        ]);
        const exifDistance = parseFloat(exifRes.rows[0]?.exif_distance || '999999');
        // Acceptable variance within 100 meters due to mobile GPS drift vs camera sensor
        exifVerified = exifDistance <= 100.0;
      }

      // 2. Spatial Deduplication Query: find active issue within 25m for this category
      const spatialQuery = `
        SELECT 
          i.id,
          i.tracking_number,
          i.report_count,
          i.upvotes_count,
          i.ml_severity_score,
          i.created_at,
          i.status,
          c.base_urgency_weight,
          c.sla_hours,
          ST_Distance(
            i.location, 
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          ) AS distance_meters
        FROM issues i
        JOIN categories c ON c.id = i.category_id
        WHERE i.category_id = $3
          AND i.status IN ('REPORTED', 'IN_REVIEW', 'IN_PROGRESS')
          AND ST_DWithin(
            i.location, 
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
            $4
          )
        ORDER BY distance_meters ASC
        LIMIT 1
        FOR UPDATE;
      `;

      const spatialRes = await client.query(spatialQuery, [
        longitude,
        latitude,
        categoryId,
        this.SPATIAL_PROXIMITY_THRESHOLD_METERS
      ]);

      let issueId: string;
      let trackingNumber: string;
      let isDuplicate = false;
      let distanceMeters: number | undefined;
      let finalReportCount = 1;
      let updatedPriorityScore = 1.0;
      let currentStatus = 'REPORTED';

      if (spatialRes.rows.length > 0) {
        // --- DUPLICATE DETECTED ---
        isDuplicate = true;
        const matched = spatialRes.rows[0];
        issueId = matched.id;
        trackingNumber = matched.tracking_number;
        distanceMeters = parseFloat(matched.distance_meters);
        currentStatus = matched.status;
        finalReportCount = matched.report_count + 1;

        // Recalculate dynamic priority score
        updatedPriorityScore = PrioritizationEngine.computePriorityScore({
          mlSeverity: parseFloat(matched.ml_severity_score),
          reportCount: finalReportCount,
          upvotesCount: matched.upvotes_count,
          createdAt: new Date(matched.created_at),
          baseUrgencyWeight: parseFloat(matched.base_urgency_weight),
          slaHours: matched.sla_hours
        });

        // Update aggregated issue
        const updateIssueQuery = `
          UPDATE issues
          SET report_count = report_count + 1,
              priority_score = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2;
        `;
        await client.query(updateIssueQuery, [updatedPriorityScore, issueId]);
      } else {
        // --- NOVEL ISSUE ---
        isDuplicate = false;
        trackingNumber = `CIV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Fetch category defaults for SLA and weight
        const catRes = await client.query(
          `SELECT base_urgency_weight, sla_hours FROM categories WHERE id = $1;`,
          [categoryId]
        );
        const baseUrgencyWeight = parseFloat(catRes.rows[0]?.base_urgency_weight || '1.0');
        const slaHours = catRes.rows[0]?.sla_hours || 48;

        const initialPriority = PrioritizationEngine.computePriorityScore({
          mlSeverity: mlSeverityScore,
          reportCount: 1,
          upvotesCount: 0,
          createdAt: new Date(),
          baseUrgencyWeight,
          slaHours
        });
        updatedPriorityScore = initialPriority;

        const insertIssueQuery = `
          INSERT INTO issues (
            tracking_number,
            category_id,
            title,
            description,
            location,
            status,
            report_count,
            upvotes_count,
            ml_detected_category,
            ml_confidence,
            ml_severity_score,
            priority_score
          )
          VALUES (
            $1, $2, $3, $4,
            ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
            'REPORTED',
            1, 0,
            $7, $8, $9, $10
          )
          RETURNING id, tracking_number, status;
        `;

        const newIssueRes = await client.query(insertIssueQuery, [
          trackingNumber,
          categoryId,
          title || 'Civic Infrastructure Concern',
          userComment || 'Reported via CivicResolve Client',
          longitude,
          latitude,
          mlCategory || 'general',
          mlConfidence || 0.85,
          mlSeverityScore,
          updatedPriorityScore
        ]);

        issueId = newIssueRes.rows[0].id;
        trackingNumber = newIssueRes.rows[0].tracking_number;
        currentStatus = newIssueRes.rows[0].status;
      }

      // 3. Insert individual citizen report linked to this issue
      const insertReportQuery = `
        INSERT INTO issue_reports (
          issue_id,
          reporter_id,
          client_location,
          gps_accuracy_meters,
          is_on_site,
          raw_image_url,
          compressed_image_url,
          exif_timestamp,
          exif_location,
          exif_verified,
          user_comment,
          device_info
        )
        VALUES (
          $1, $2,
          ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
          $5, $6, $7, $8, $9,
          CASE WHEN $10::double precision IS NOT NULL AND $11::double precision IS NOT NULL 
               THEN ST_SetSRID(ST_MakePoint($10, $11), 4326)::geography 
               ELSE NULL END,
          $12, $13, $14
        )
        RETURNING id;
      `;

      const reportRes = await client.query(insertReportQuery, [
        issueId,
        reporterId,
        longitude,
        latitude,
        gpsAccuracyMeters || null,
        isOnSite,
        rawImageUrl,
        compressedImageUrl || null,
        exifTimestamp || null,
        exifLongitude || null,
        exifLatitude || null,
        exifVerified,
        userComment || null,
        deviceInfo ? JSON.stringify(deviceInfo) : null
      ]);

      await client.query('COMMIT');

      return {
        isDuplicate,
        issueId,
        reportId: reportRes.rows[0].id,
        trackingNumber,
        distanceFromExistingMeters: distanceMeters,
        currentReportCount: finalReportCount,
        updatedPriorityScore,
        status: currentStatus
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
