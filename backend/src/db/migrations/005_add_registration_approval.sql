-- Migration: Add Registration Approval System
-- Adds app_settings table for global configuration
-- Adds user approval columns to users table

-- Create app_settings table (singleton pattern with id=1)
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    registration_requires_approval INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings row if not exists
INSERT OR IGNORE INTO app_settings (id, registration_requires_approval) VALUES (1, 0);

-- Add approval columns to users table
-- is_approved: 1 = approved, 0 = pending approval
-- approved_by: reference to the admin who approved (nullable)
-- approved_at: timestamp when approved (nullable)
ALTER TABLE users ADD COLUMN is_approved INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN approved_by TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN approved_at DATETIME;

-- Create index for efficient filtering of pending users
CREATE INDEX IF NOT EXISTS idx_users_is_approved ON users(is_approved);

-- Mark all existing users as approved (they were created before this feature)
UPDATE users SET is_approved = 1 WHERE is_approved IS NULL;
