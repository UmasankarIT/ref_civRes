-- ============================================================================
-- CivicResolve Database Schema Definition
-- PostgreSQL 15+ with PostGIS 3.3+
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enumerations
CREATE TYPE user_role AS ENUM (
    'citizen',
    'municipal_staff',
    'department_admin',
    'super_admin'
);

CREATE TYPE issue_status AS ENUM (
    'reported',
    'in_review',
    'verified',
    'assigned',
    'in_progress',
    'resolved',
    'rejected'
);

CREATE TYPE issue_urgency AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

-- ============================================================================
-- TABLE: categories
-- Standardized classification catalog with municipal department mappings & SLA
-- ============================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,             -- e.g., 'ROAD_POTHOLE', 'SEWAGE_OVERFLOW'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_severity_weight NUMERIC(3, 2) NOT NULL DEFAULT 1.00, -- Multiplier for prioritization
    default_sla_hours INT NOT NULL DEFAULT 72,
    responsible_department VARCHAR(100) NOT NULL, -- e.g., 'Public Works Department (PWD)'
    icon_name VARCHAR(50) NOT NULL DEFAULT 'AlertTriangle',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed baseline categories
INSERT INTO categories (code, name, description, base_severity_weight, default_sla_hours, responsible_department, icon_name) VALUES
('ROAD_POTHOLE', 'Pothole & Road Hazard', 'Potholes, surface cracks, cratering, and pavement depression', 1.20, 48, 'Public Works & Roads Dept', 'Construction'),
('DRAINAGE_OVERFLOW', 'Drainage & Sewage Leak', 'Open manholes, blocked storm drains, and sewage overflow', 1.40, 24, 'Water Supply & Sewerage Board', 'Droplets'),
('GARBAGE_DUMP', 'Garbage & Solid Waste Pile', 'Illegal dump sites, overflowing public bins, hazardous debris', 1.00, 36, 'Solid Waste Management', 'Trash2'),
('STREETLIGHT_OUTAGE', 'Streetlight / Electrical Failure', 'Non-functioning streetlights, exposed cables, dark safety spots', 0.85, 72, 'Electrical & Power Cell', 'Lightbulb'),
('WATER_SUPPLY_BURST', 'Main Water Pipeline Leak', 'Clean water supply line burst or flooding public corridors', 1.50, 12, 'Water Supply & Sewerage Board', 'Waves')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- TABLE: users
-- Support for Citizens, Field Engineers, and Department Administrators
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    full_name VARCHAR(150),
    role user_role NOT NULL DEFAULT 'citizen',
    department VARCHAR(100),                      -- For municipal staff
    assigned_zone VARCHAR(100),                    -- Municipal ward / jurisdiction
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    trust_score NUMERIC(4, 2) NOT NULL DEFAULT 1.00, -- Weighted reputation based on valid reports
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_role_dept ON users(role, department);

-- ============================================================================
-- TABLE: issues (Canonical Aggregated Incident)
-- The consolidated entity representing a physical ground issue.
-- Multiple citizen submissions within proximity point to this single issue.
-- ============================================================================
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Spatial Core Field: WGS 84 (SRID 4326) Point stored as geography
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude NUMERIC(9, 6) GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
    longitude NUMERIC(9, 6) GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
    formatted_address TEXT,
    ward_id VARCHAR(50),
    
    -- Status & Lifecycle
    status issue_status NOT NULL DEFAULT 'reported',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_worker_name VARCHAR(150),
    
    -- Dynamic Aggregation & Ranking Metrics
    report_count INT NOT NULL DEFAULT 1,
    community_upvotes INT NOT NULL DEFAULT 0,
    ml_severity_score NUMERIC(3, 2) DEFAULT NULL, -- Populated by Vision model (scale 1.00 - 5.00)
    priority_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    
    -- Resolution Metadata
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_proof_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crucial Spatial Index for Fast Deduplication Checks (GiST)
CREATE INDEX idx_issues_location_gist ON issues USING GIST(location);

-- Indexes for Public Map & Municipal Admin Dashboard Queries
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_category ON issues(category_id);
CREATE INDEX idx_issues_priority ON issues(priority_score DESC);
CREATE INDEX idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX idx_issues_active_lookup ON issues(category_id, status) WHERE status NOT IN ('resolved', 'rejected');

-- ============================================================================
-- TABLE: issue_reports
-- Every raw submission from a citizen. If an issue already exists nearby,
-- the report is appended here and linked to the canonical issue.
-- ============================================================================
CREATE TABLE issue_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Raw submission location
    submitted_location GEOGRAPHY(POINT, 4326) NOT NULL,
    location_accuracy_meters NUMERIC(6, 2),
    is_on_site BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Media Evidence
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    
    -- EXIF Inspection Payload
    exif_captured_at TIMESTAMPTZ,
    exif_location GEOGRAPHY(POINT, 4326),
    exif_distance_delta_meters NUMERIC(8, 2),
    exif_is_tampered BOOLEAN DEFAULT FALSE,
    device_signature VARCHAR(255),
    ip_address_hash VARCHAR(64), -- SHA-256 for abuse/spam prevention
    
    citizen_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_issue_id ON issue_reports(issue_id);
CREATE INDEX idx_reports_reporter_id ON issue_reports(reporter_id);
CREATE INDEX idx_reports_submitted_location_gist ON issue_reports USING GIST(submitted_location);

-- ============================================================================
-- TABLE: ml_analyses
-- Result of Computer Vision and Severity Classification
-- ============================================================================
CREATE TABLE ml_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL UNIQUE REFERENCES issue_reports(id) ON DELETE CASCADE,
    predicted_category VARCHAR(100) NOT NULL,
    category_confidence NUMERIC(4, 3) NOT NULL, -- 0.000 to 1.000
    estimated_severity NUMERIC(3, 2) NOT NULL,  -- Scale 1.00 to 5.00
    is_civic_issue BOOLEAN NOT NULL DEFAULT TRUE,
    model_version VARCHAR(50) NOT NULL,
    detected_objects JSONB DEFAULT '[]'::jsonb,
    raw_response JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ml_analyses_severity ON ml_analyses(estimated_severity);

-- ============================================================================
-- TABLE: upvotes ("I also face this problem")
-- Prevents duplicate submissions by allowing one-click endorsement
-- ============================================================================
CREATE TABLE upvotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_issue_upvote UNIQUE (user_id, issue_id)
);

CREATE INDEX idx_upvotes_issue ON upvotes(issue_id);

-- ============================================================================
-- TABLE: issue_timeline_logs
-- Comprehensive audit trail for accountability, SLA tracking, and resolution
-- ============================================================================
CREATE TABLE issue_timeline_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    previous_status issue_status,
    new_status issue_status,
    action_comment TEXT,
    event_type VARCHAR(50) NOT NULL, -- 'STATUS_CHANGE', 'ASSIGNED', 'RESOLVED', 'PRIORITY_UPDATED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_issue_id ON issue_timeline_logs(issue_id);

-- ============================================================================
-- STORED PROCEDURE / FUNCTION: calculate_priority_score
-- Implements the formula:
-- Priority = (ML_Severity * 0.35) + (log10(Report_Count + 1) * 0.30) 
--          + (Community_Upvotes * 0.20) + (Urgency_Decay_Factor * 0.15)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_priority_score(
    p_ml_severity NUMERIC,
    p_report_count INT,
    p_upvotes INT,
    p_created_at TIMESTAMPTZ
) RETURNS NUMERIC AS $$
DECLARE
    v_severity NUMERIC := COALESCE(p_ml_severity, 2.5);
    v_report_weight NUMERIC;
    v_upvote_weight NUMERIC;
    v_age_days NUMERIC;
    v_decay_factor NUMERIC;
    v_final_score NUMERIC;
BEGIN
    -- Logarithmic scaling for aggregate report count: log10(N + 1)
    v_report_weight := LOG(10, GREATEST(p_report_count, 1) + 1);

    -- Linear upvote scaling with soft upper cap of 5.0
    v_upvote_weight := LEAST((p_upvotes * 0.2), 5.0);

    -- Time Urgency: unresolved issues accumulate urgency over days
    v_age_days := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 86400.0;
    v_decay_factor := LEAST(v_age_days * 0.5, 5.0);

    -- Compute dynamic priority
    v_final_score := (v_severity * 0.35) +
                     (v_report_weight * 0.30) +
                     (v_upvote_weight * 0.20) +
                     (v_decay_factor * 0.15);

    RETURN ROUND(v_final_score, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
