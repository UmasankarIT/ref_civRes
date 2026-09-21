import { NextRequest, NextResponse } from 'next/server';
import { civicStore } from '@/lib/store';
import { findNearbyActiveIssue, generateMockAddress, calculateGeodesicDistanceMeters } from '@/lib/spatial';
import { calculatePriorityScore } from '@/lib/scoring';
import { analyzeIssueImage } from '@/lib/mlVision';
import { CreateReportRequest, Issue, IssueReport } from '@/lib/types';
import { getSession, unauthorized } from '@/lib/auth';
import { departmentForCategory } from '@/lib/departments';
import { slaDeadlineFor } from '@/lib/workflow';
import { logAction, notifyUser } from '@/lib/events';
import { CITY_ADMIN_USER_ID } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // RBAC: every report must come from a signed-in actor. Citizens report on
    // their own behalf; staff/admin may also surface issues they spot in field.
    const user = await getSession(req);
    if (!user) {
      return unauthorized('Sign in to submit a report.');
    }

    const body = (await req.json()) as CreateReportRequest;

    if (!body.categoryId || body.latitude === undefined || body.longitude === undefined || !body.imageUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: categoryId, latitude, longitude, and imageUrl are required.' },
        { status: 400 }
      );
    }

    const category = civicStore.getCategoryById(body.categoryId);
    if (!category) {
      return NextResponse.json({ error: 'Invalid category specified.' }, { status: 400 });
    }

    // Automatic department routing — ambiguous/OTHERS land in triage (DEPT_UNASSIGNED)
    const dept = departmentForCategory(category);

    // 1. Process EXIF metadata and detect any coordinate tampering/spoofing
    const exif = body.exif || { hasGps: false };
    if (exif.hasGps && exif.exifLatitude && exif.exifLongitude) {
      const delta = calculateGeodesicDistanceMeters(
        body.latitude,
        body.longitude,
        exif.exifLatitude,
        exif.exifLongitude
      );
      exif.deltaMeters = Math.round(delta * 10) / 10;
      // If photo GPS is more than 300m away from device reporting GPS, flag spoofing warning
      exif.isSpoofed = delta > 300;
    }

    // 2. Run Computer Vision Pipeline for Categorization and Severity Assessment
    const mlAnalysis = await analyzeIssueImage(body.imageUrl, category.code, body.citizenNotes);

    if (!mlAnalysis.isCivicIssue) {
      return NextResponse.json(
        {
          error: 'Uploaded image was flagged by ML as non-civic or spam.',
          mlAnalysis,
        },
        { status: 422 }
      );
    }

    // 3. PostGIS ST_DWithin Geodesic Deduplication Check (25m threshold)
    const activeIssues = civicStore.getIssues();
    const match = findNearbyActiveIssue(body.latitude, body.longitude, category.id, activeIssues, 25.0);

    const reportId = `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (match) {
      // --- DUPLICATE ACTIVE INCIDENT FOUND WITHIN 25M ---
      const existingIssue = match.issue;

      const report: IssueReport = {
        id: reportId,
        issueId: existingIssue.id,
        citizenUserId: user.userId,
        latitude: body.latitude,
        longitude: body.longitude,
        accuracyMeters: body.accuracyMeters || 10,
        isOnSite: body.isOnSite,
        imageUrl: body.imageUrl,
        citizenNotes: body.citizenNotes,
        audioUrl: body.audioUrl,
        transcript: body.transcript,
        exif,
        locationDetails: body.locationDetails,
        createdAt: new Date().toISOString(),
      };

      // Add to store & atomically recalculate priority
      civicStore.addReport(report);
      const updatedIssue = civicStore.incrementIssueReport(existingIssue.id, report);

      logAction(user, 'reports.submit.duplicate', `Matched existing incident ${existingIssue.id} within ${match.distanceMeters}m.`, existingIssue.id);

      return NextResponse.json({
        issueId: existingIssue.id,
        isDuplicate: true,
        proximityDistanceMeters: match.distanceMeters,
        reportCount: updatedIssue ? updatedIssue.reportCount : existingIssue.reportCount + 1,
        status: existingIssue.status,
        priorityScore: updatedIssue ? updatedIssue.priorityScore : existingIssue.priorityScore,
        mlAnalysis,
        message: `Linked to existing active incident (${match.distanceMeters}m away). Priority rank escalated to ${updatedIssue?.priorityScore}.`,
      });
    }

    // --- NOVEL CIVIC INCIDENT ---
    const issueId = `iss-${Date.now()}`;
    const initialSeverity = mlAnalysis.estimatedSeverity || category.baseSeverityWeight * 2.5;

    const priorityBreakdown = calculatePriorityScore({
      mlSeverity: initialSeverity,
      reportCount: 1,
      communityUpvotes: 0,
      createdAt: new Date(),
    });

    const newReport: IssueReport = {
      id: reportId,
      issueId,
      citizenUserId: user.userId,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyMeters: body.accuracyMeters || 10,
      isOnSite: body.isOnSite,
      imageUrl: body.imageUrl,
      citizenNotes: body.citizenNotes,
      audioUrl: body.audioUrl,
      transcript: body.transcript,
      exif,
      locationDetails: body.locationDetails,
      createdAt: new Date().toISOString(),
    };

    const newIssue: Issue = {
      id: issueId,
      categoryId: category.id,
      category,
      title: body.title || `${category.name} Reported`,
      description: body.citizenNotes || `Citizen reported ${category.name.toLowerCase()} requiring municipal attention.`,
      latitude: body.latitude,
      longitude: body.longitude,
      formattedAddress: generateMockAddress(body.latitude, body.longitude),
      locationDetails: body.locationDetails,
      departmentId: dept.id,
      jurisdictionCode: body.locationDetails?.mandal || body.locationDetails?.pincode,
      citizenUserId: user.userId,
      citizenName: user.name,
      slaDeadlineAt: slaDeadlineFor(dept.slaHours),
      audioUrl: body.audioUrl,
      transcript: body.transcript,
      status: 'reported',
      reportCount: 1,
      communityUpvotes: 0,
      mlSeverityScore: initialSeverity,
      priorityScore: priorityBreakdown.totalScore,
      imageUrl: body.imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reports: [newReport],
      mlAnalysis,
    };

    civicStore.addIssue(newIssue);
    civicStore.addReport(newReport);

    logAction(user, 'reports.submit', `${category.name} routed to ${dept.name}.`, issueId);
    notifyUser(
      CITY_ADMIN_USER_ID,
      'New report in triage',
      `${category.name} near ${newIssue.formattedAddress} — routed to ${dept.name}.`,
      issueId
    );

    return NextResponse.json({
      issueId,
      isDuplicate: false,
      reportCount: 1,
      status: 'reported',
      departmentId: dept.id,
      priorityScore: priorityBreakdown.totalScore,
      mlAnalysis,
      message: `New incident logged and routed to ${dept.name}.`,
    });
  } catch (error: unknown) {
    console.error('Error submitting report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error processing report.' },
      { status: 500 }
    );
  }
}
