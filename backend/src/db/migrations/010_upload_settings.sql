-- Add upload configuration settings to app_settings
-- max_upload_size_mb: Maximum file size in MB for attachment uploads (default 10)
-- allowed_attachment_extensions: JSON array of allowed file extensions (NULL = use system defaults)
ALTER TABLE app_settings ADD COLUMN max_upload_size_mb INTEGER DEFAULT 10;
ALTER TABLE app_settings ADD COLUMN allowed_attachment_extensions TEXT DEFAULT NULL;
