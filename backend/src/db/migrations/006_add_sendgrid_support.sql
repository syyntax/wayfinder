-- Add SendGrid Web API support as alternative to SMTP
-- Migration: 006_add_sendgrid_support.sql

-- Add mail_provider column to specify which email provider to use
-- Defaults to 'smtp' for backwards compatibility
ALTER TABLE mail_settings ADD COLUMN mail_provider TEXT DEFAULT 'smtp' CHECK (mail_provider IN ('smtp', 'sendgrid'));

-- Add SendGrid-specific from settings
-- These are used when mail_provider = 'sendgrid'
-- Note: The actual API key is stored in the SENDGRID_WEB_API_KEY environment variable for security
ALTER TABLE mail_settings ADD COLUMN sendgrid_from_email TEXT;
ALTER TABLE mail_settings ADD COLUMN sendgrid_from_name TEXT DEFAULT 'Wayfinder';
