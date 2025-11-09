-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Companies table (multi-tenant support)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Servers table
CREATE TABLE IF NOT EXISTS servers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'offline', -- online, offline, warning, error
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

-- Create index for faster company lookups
CREATE INDEX idx_servers_company_id ON servers(company_id);
CREATE INDEX idx_servers_status ON servers(status);

-- Metrics table (time-series data)
CREATE TABLE IF NOT EXISTS metrics (
    time TIMESTAMPTZ NOT NULL,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- cpu, memory, disk, network
    value DOUBLE PRECISION NOT NULL,
    metadata JSONB, -- Additional context like disk mount point, network interface, etc.
    PRIMARY KEY (time, server_id, metric_type)
);

-- Convert metrics table to hypertable for time-series optimization
SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);

-- Create index for faster metric queries
CREATE INDEX idx_metrics_server_time ON metrics(server_id, time DESC);
CREATE INDEX idx_metrics_type ON metrics(metric_type, time DESC);

-- Set data retention policy (1 year)
SELECT add_retention_policy('metrics', INTERVAL '1 year', if_not_exists => TRUE);

-- Docker containers table
CREATE TABLE IF NOT EXISTS docker_containers (
    id SERIAL PRIMARY KEY,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    container_id VARCHAR(255) NOT NULL,
    container_name VARCHAR(255) NOT NULL,
    image VARCHAR(255),
    status VARCHAR(50), -- running, stopped, paused, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, container_id)
);

CREATE INDEX idx_docker_server_id ON docker_containers(server_id);

-- Docker container status history (time-series)
CREATE TABLE IF NOT EXISTS docker_status_history (
    time TIMESTAMPTZ NOT NULL,
    container_id INTEGER NOT NULL REFERENCES docker_containers(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    cpu_usage DOUBLE PRECISION,
    memory_usage DOUBLE PRECISION,
    PRIMARY KEY (time, container_id)
);

SELECT create_hypertable('docker_status_history', 'time', if_not_exists => TRUE);
SELECT add_retention_policy('docker_status_history', INTERVAL '1 year', if_not_exists => TRUE);

-- Services table (HTTPS endpoints, databases, etc.)
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL, -- http, https, postgresql, mysql, mongodb, etc.
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500) NOT NULL, -- URL or connection string
    expected_status_code INTEGER, -- For HTTP services
    check_interval INTEGER DEFAULT 60, -- Seconds between checks
    timeout INTEGER DEFAULT 10, -- Timeout in seconds
    status VARCHAR(50) DEFAULT 'unknown', -- up, down, degraded
    last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, name)
);

CREATE INDEX idx_services_server_id ON services(server_id);
CREATE INDEX idx_services_status ON services(status);

-- Service check history (time-series)
CREATE TABLE IF NOT EXISTS service_checks (
    time TIMESTAMPTZ NOT NULL,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL, -- up, down, degraded
    response_time INTEGER, -- Response time in milliseconds
    status_code INTEGER, -- HTTP status code
    error_message TEXT,
    PRIMARY KEY (time, service_id)
);

SELECT create_hypertable('service_checks', 'time', if_not_exists => TRUE);
SELECT add_retention_policy('service_checks', INTERVAL '1 year', if_not_exists => TRUE);

CREATE INDEX idx_service_checks_service_time ON service_checks(service_id, time DESC);

-- Alerts configuration table
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- cpu, memory, disk, network, service_down
    condition VARCHAR(10) NOT NULL, -- gt (>), lt (<), gte (>=), lte (<=), eq (=)
    threshold DOUBLE PRECISION NOT NULL,
    duration INTEGER DEFAULT 60, -- Seconds the condition must persist
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alert_rules_server_id ON alert_rules(server_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

-- Incidents table (when alerts are triggered)
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    alert_rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    incident_type VARCHAR(50) NOT NULL, -- metric_threshold, service_down, server_offline
    severity VARCHAR(20) DEFAULT 'warning', -- info, warning, critical
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open', -- open, acknowledged, resolved
    triggered_at TIMESTAMP NOT NULL,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    metadata JSONB, -- Additional context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_incidents_server_id ON incidents(server_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_triggered_at ON incidents(triggered_at DESC);

-- Logs table (time-series)
CREATE TABLE IF NOT EXISTS logs (
    time TIMESTAMPTZ NOT NULL,
    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    container_id INTEGER REFERENCES docker_containers(id) ON DELETE CASCADE,
    log_level VARCHAR(20), -- info, warning, error, debug
    source VARCHAR(100), -- system, docker, application
    message TEXT NOT NULL,
    metadata JSONB,
    PRIMARY KEY (time, server_id)
);

SELECT create_hypertable('logs', 'time', if_not_exists => TRUE);
SELECT add_retention_policy('logs', INTERVAL '90 days', if_not_exists => TRUE);

CREATE INDEX idx_logs_server_time ON logs(server_id, time DESC);
CREATE INDEX idx_logs_level ON logs(log_level, time DESC);

-- FCM tokens for push notifications
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    device_info JSONB, -- Device metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);

-- Insert default admin user (password: admin123 - hashed with bcrypt)
-- Password should be changed after first login
INSERT INTO users (username, password_hash, email)
VALUES ('admin', '$2a$10$4nM7rOZ8nCtMBFGWEKXpm.J0UlhXJBc5Ukz1gIYZhkMqr.wtsvvQy', 'admin@monitor.local')
ON CONFLICT (username) DO NOTHING;

-- Insert sample company for testing
INSERT INTO companies (name, description)
VALUES ('Default Company', 'Default company for testing')
ON CONFLICT DO NOTHING;
