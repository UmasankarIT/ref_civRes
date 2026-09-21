-- ====================================================================
-- CivicResolve: Production PostgreSQL + PostGIS Database Schema
-- Spatial Issue Tracking, Deduplication, and Prioritization Engine
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Custom Enumerations
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('citizen', 'municipal_staff', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_status AS ENUM ('REPORTED', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'DUPLICATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE severity_level AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'EMERGENCY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(32),
    full_name VARCHAR(128) NOT NULL,
    role user_role NOT NULL DEFAULT 'citizen',
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(128), -- For municipal_staff (e.g., 'Sanitation', 'Roads & Bridges')
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 4. Issue Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(64) UNIQUE NOT NULL, -- 'pothole', 'broken_drainage', 'sewage', 'garbage', 'street_light', 'road_damage'
    name VARCHAR(128) NOT NULL,
    description TEXT,
    base_urgency_weight NUMERIC(3, 2) NOT NULL DEFAULT 1.00, -- Multiplier for base urgency
    sla_hours INTEGER NOT NULL DEFAULT 72, -- Target resolution window in hours
    icon_name VARCHAR(64) NOT NULL DEFAULT 'alert-circle',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Primary Aggregated Issues Table
-- Represents an authoritative physical infrastructure incident at a distinct location
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_number VARCHAR(32) UNIQUE NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Spatial Location: WGS 84 (SRID 4326) geography point for accurate geodesic distance queries
    location GEOGRAPHY(Point, 4326) NOT NULL,
    address_text TEXT,
    neighborhood VARCHAR(128),
    city VARCHAR(128) DEFAULT 'Metropolis',
    
    -- Status & Workflow
    status issue_status NOT NULL DEFAULT 'REPORTED',
    assigned_department VARCHAR(128),
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Deduplication & Engagement Aggregation
    report_count INTEGER NOT NULL DEFAULT 1,
    upvotes_count INTEGER NOT NULL DEFAULT 0,
    
    -- Machine Learning Analysis
    ml_detected_category VARCHAR(64),
    ml_confidence NUMERIC(4, 3), -- Range 0.000 to 1.000
    ml_severity_score NUMERIC(3, 2) DEFAULT 1.00 CHECK (ml_severity_score >= 1.00 AND ml_severity_score <= 5.00),
    
    -- Dynamic Prioritization Score
    -- Formula: (ML_Severity * 0.35) + (log(Report_Count + 1) * 0.30) + (Community_Upvotes * 0.20) + (Urgency_Decay_Factor * 0.15)
    priority_score NUMERIC(6, 3) NOT NULL DEFAULT 1.000,
    
    -- Resolution Metadata
    resolution_proof_url TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Spatial GIST Index for Sub-second Proximity Queries
CREATE INDEX IF NOT EXISTS idx_issues_location_gist ON issues USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues (status);
CREATE INDEX IF NOT EXISTS idx_issues_priority_score ON issues (priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_issues_category_id ON issues (category_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues (created_at DESC);

-- 6. Individual Citizen Issue Reports Table
-- Stores each individual citizen's submission linked to an aggregated issue
CREATE TABLE IF NOT EXISTS issue_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable for anonymous/guest submissions
    
    -- GPS & Location Verification Metadata
    client_location GEOGRAPHY(Point, 4326) NOT NULL,
    gps_accuracy_meters NUMERIC(6, 2),
    is_on_site BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- EXIF Verification Metadata
    raw_image_url TEXT NOT NULL,
    compressed_image_url TEXT,
    exif_timestamp TIMESTAMPTZ,
    exif_location GEOGRAPHY(Point, 4326),
    exif_verified BOOLEAN DEFAULT FALSE,
    
    user_comment TEXT,
    device_info JSONB, -- User agent, OS, client IP hash
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_issue_id ON issue_reports (issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_reporter_id ON issue_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_client_location_gist ON issue_reports USING GIST (client_location);
CREATE INDEX IF NOT EXISTS idx_issue_reports_created_at ON issue_reports (created_at DESC);

-- 7. Upvotes / Endorsements Table ("I also faced this")
CREATE TABLE IF NOT EXISTS upvotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_issue_user_upvote UNIQUE (issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_upvotes_issue_id ON upvotes (issue_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_user_id ON upvotes (user_id);

-- 8. Issue Status Audit Log Table
CREATE TABLE IF NOT EXISTS issue_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    previous_status issue_status NOT NULL,
    new_status issue_status NOT NULL,
    notes TEXT,
    proof_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_history_issue_id ON issue_status_history (issue_id);

-- ====================================================================
-- 9. PostGIS Spatial Functions & Automated Prioritization Logic
-- ====================================================================

-- Function: Check for active duplicates within proximity threshold (default 25 meters)
CREATE OR REPLACE FUNCTION find_nearby_active_issue(
    p_location GEOGRAPHY(Point, 4326),
    p_category_id UUID,
    p_radius_meters DOUBLE PRECISION DEFAULT 25.0
)
RETURNS TABLE (
    issue_id UUID,
    distance_meters DOUBLE PRECISION,
    tracking_number VARCHAR,
    current_status issue_status
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id AS issue_id,
        ST_Distance(i.location, p_location) AS distance_meters,
        i.tracking_number,
        i.status AS current_status
    FROM issues i
    WHERE i.category_id = p_category_id
      AND i.status IN ('REPORTED', 'IN_REVIEW', 'IN_PROGRESS')
      AND ST_DWithin(i.location, p_location, p_radius_meters)
    ORDER BY distance_meters ASC
    LIMIT 1;
END;
$$;

-- Function: Compute dynamic priority score
-- Priority = (ML_Severity * 0.35) + (log(Report_Count + 1) * 0.30) + (Community_Upvotes * 0.20) + (Urgency_Decay_Factor * 0.15)
-- Urgency_Decay_Factor escalates as time elapses without resolution (age in days capped at 10)
CREATE OR REPLACE FUNCTION calculate_priority_score(
    p_ml_severity NUMERIC,
    p_report_count INTEGER,
    p_upvotes INTEGER,
    p_created_at TIMESTAMPTZ,
    p_base_urgency_weight NUMERIC DEFAULT 1.00
)
RETURNS NUMERIC(6, 3)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_ml_severity NUMERIC := COALESCE(p_ml_severity, 1.0);
    v_report_count NUMERIC := COALESCE(p_report_count, 1);
    v_upvotes NUMERIC := COALESCE(p_upvotes, 0);
    v_days_open NUMERIC;
    v_urgency_decay NUMERIC;
    v_score NUMERIC;
BEGIN
    -- Calculate age in days (scale from 1 to 5 based on open duration)
    v_days_open := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p_created_at)) / 86400.0;
    -- Cap urgency decay boost at 5.0, minimum 1.0
    v_urgency_decay := LEAST(5.0, GREATEST(1.0, 1.0 + (v_days_open * 0.4))) * COALESCE(p_base_urgency_weight, 1.0);

    -- Priority weighted calculation
    v_score := (v_ml_severity * 0.35) 
             + (LOG(10, v_report_count + 1) * 0.30 * 2.5) -- Scaled logarithm to align with 1-5 scale
             + (LEAST(5.0, v_upvotes * 0.25) * 0.20) 
             + (v_urgency_decay * 0.15);

    RETURN ROUND(v_score, 3);
END;
$$;

-- Trigger: Automatically recalculate priority score on issue update
CREATE OR REPLACE FUNCTION trigger_recalculate_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_base_weight NUMERIC := 1.00;
BEGIN
    SELECT base_urgency_weight INTO v_base_weight 
    FROM categories 
    WHERE id = NEW.category_id;

    NEW.priority_score := calculate_priority_score(
        NEW.ml_severity_score,
        NEW.report_count,
        NEW.upvotes_count,
        NEW.created_at,
        v_base_weight
    );
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_priority ON issues;
CREATE TRIGGER trg_recalculate_priority
    BEFORE INSERT OR UPDATE OF ml_severity_score, report_count, upvotes_count
    ON issues
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_priority();

-- Trigger: Update upvotes count when an upvote is added or deleted
CREATE OR REPLACE FUNCTION trigger_update_upvote_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE issues 
        SET upvotes_count = upvotes_count + 1 
        WHERE id = NEW.issue_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE issues 
        SET upvotes_count = GREATEST(0, upvotes_count - 1) 
        WHERE id = OLD.issue_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_upvotes ON upvotes;
CREATE TRIGGER trg_update_upvotes
    AFTER INSERT OR DELETE ON upvotes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_upvote_counter();

-- ====================================================================
-- 10. Seed Core Categories
-- ====================================================================
INSERT INTO categories (slug, name, description, base_urgency_weight, sla_hours, icon_name)
VALUES
    ('pothole', 'Pothole & Road Surface Damage', 'Damaged road surface, craters, asphalt cracking causing traffic hazards', 1.20, 48, 'alert-triangle'),
    ('broken_drainage', 'Broken Drainage & Open Manholes', 'Damaged stormwater drains, missing manhole covers risking pedestrian injury', 1.50, 24, 'shield-alert'),
    ('sewage', 'Sewage Overflow & Leakage', 'Contaminated sewage water spilling onto streets or public pathways', 1.40, 24, 'biohazard'),
    ('garbage', 'Illegal Garbage Dumping', 'Accumulation of municipal solid waste or overflowed dumpsters', 1.00, 36, 'trash-2'),
    ('street_light', 'Broken Streetlight & Electrical Hazards', 'Non-functional streetlights or exposed electrical cables', 1.10, 72, 'lightbulb-off'),
    ('road_damage', 'Cave-in & Structural Road Hazard', 'Major structural road collapse, landslide obstruction', 1.60, 12, 'shield-x')
ON CONFLICT (slug) DO NOTHING;
