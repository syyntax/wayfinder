-- Add mail settings table for SMTP configuration
-- Migration: 003_add_mail_settings.sql

CREATE TABLE IF NOT EXISTS mail_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton table, only one row allowed
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_secure INTEGER DEFAULT 1,  -- Boolean: 1 = true (use TLS), 0 = false
    smtp_username TEXT,
    smtp_password_encrypted TEXT,  -- Encrypted SMTP password
    from_email TEXT,
    from_name TEXT DEFAULT 'Wayfinder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default empty row (singleton pattern)
INSERT OR IGNORE INTO mail_settings (id) VALUES (1);
