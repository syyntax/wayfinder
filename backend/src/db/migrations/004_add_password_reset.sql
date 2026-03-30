-- Migration: Add password reset columns to users table
-- This adds support for the "Forgot Password" feature

-- Add password reset token column (stores cryptographically secure random token)
ALTER TABLE users ADD COLUMN password_reset_token TEXT;

-- Add password reset expiration column (token expires after 1 hour)
ALTER TABLE users ADD COLUMN password_reset_expires DATETIME;

-- Create index for efficient token lookups
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
