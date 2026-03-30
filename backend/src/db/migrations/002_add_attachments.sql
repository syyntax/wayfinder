-- Add attachments table for file uploads
-- Migration: 002_add_attachments.sql

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for faster lookups by card
CREATE INDEX IF NOT EXISTS idx_attachments_card ON attachments(card_id);

-- Index for faster lookups by uploader
CREATE INDEX IF NOT EXISTS idx_attachments_user ON attachments(uploaded_by);
