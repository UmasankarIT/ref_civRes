-- ====================================================================
-- CivicResolve: App-compatible PostgreSQL + PostGIS schema
-- Primary keys are application-generated string IDs (e.g. 'iss-...',
-- 'rep-...', 'not-...', 'log-...', 'cat-...', 'DEPT_...') so the store
-- can persist the exact IDs the Next.js app already generates.
--
-- This migration contains NO seed data — categories and departments are
-- upserted from their TypeScript sources (src/lib/store.ts and
-- src/lib/departments.ts) on first boot so there is a single source of
-- truth for demo data.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- --------------------------------------------------------------------
-- Categories — application category catalog ('cat-road-pothole', ...)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    base_severity_weight NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    default_sla_hours INTEGER NOT NULL DEFAULT 72,
    responsible_department TEXT NOT NULL DEFAULT '',
    icon_name TEXT NOT NULL DEFAULT 'alert-circle',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- Departments — dynamic municipal catalog ('DEPT_WATER', ...)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    nodal_officer TEXT NOT NULL DEFAULT 'Nodal Officer',
    sla_hours INTEGER NOT NULL DEFAULT 72,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    category_codes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- Issues — aggregated civic incidents at a distinct physical location
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    formatted_address TEXT,
    ward_id TEXT,
    location_details JSONB,
    status TEXT NOT NULL DEFAULT 'reported',
    assigned_worker_name TEXT,
    assigned_department TEXT,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    jurisdiction_code TEXT,
    citizen_user_id TEXT,
    citizen_name TEXT,
    sla_deadline_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    merged_into_id TEXT,
    audio_url TEXT,
    transcript TEXT,
    report_count INTEGER NOT NULL DEFAULT 1,
    upvotes_count INTEGER NOT NULL DEFAULT 0,
    ml_severity_score NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    priority_score NUMERIC(6, 3) NOT NULL DEFAULT 1.000,
    image_url TEXT NOT NULL,
    ml_analysis JSONB,
    reassign_request JSONB,
    proof JSONB,
    resolution_notes TEXT,
    resolution_proof_url TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Spatial GIST index for fast proximity/dedup queries
CREATE INDEX IF NOT EXISTS idx_issues_location_gist ON issues USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues (status);
CREATE INDEX IF NOT EXISTS idx_issues_priority_score ON issues (priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_issues_category_id ON issues (category_id);
CREATE INDEX IF NOT EXISTS idx_issues_citizen_user_id ON issues (citizen_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_department_id ON issues (department_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues (created_at DESC);

-- --------------------------------------------------------------------
-- issue_reports — each individual citizen submission linked to an issue
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issue_reports (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    reporter_id TEXT,
    citizen_user_id TEXT,
    client_location GEOGRAPHY(Point, 4326) NOT NULL,
    accuracy_meters INTEGER NOT NULL DEFAULT 10,
    is_on_site BOOLEAN NOT NULL DEFAULT TRUE,
    image_url TEXT NOT NULL,
    citizen_notes TEXT,
    audio_url TEXT,
    transcript TEXT,
    exif JSONB,
    location_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issue_reports_issue_id ON issue_reports (issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_citizen_user_id ON issue_reports (citizen_user_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_client_location_gist ON issue_reports USING GIST (client_location);
CREATE INDEX IF NOT EXISTS idx_issue_reports_created_at ON issue_reports (created_at DESC);

-- --------------------------------------------------------------------
-- upvotes — one citizen, one upvote per issue (app-enforced uniqueness)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upvotes (
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_issue_user_upvote UNIQUE (issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_upvotes_issue_id ON upvotes (issue_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_user_id ON upvotes (user_id);

-- --------------------------------------------------------------------
-- notifications — per-user pings (status, proof, merge, reassign)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    issue_id TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);

-- --------------------------------------------------------------------
-- audit_logs — append-only trace of every privileged action
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_name TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    issue_id TEXT,
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_issue_id ON audit_logs (issue_id);