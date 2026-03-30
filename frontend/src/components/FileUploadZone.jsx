import { useState, useRef, useCallback } from 'react';
import './FileUploadZone.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

const ALLOWED_ATTACHMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
];

/**
 * Check if a file is an image
 */
export function isImageFile(file) {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get file type icon class based on MIME type
 */
export function getFileIcon(mimeType) {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'sheet';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'slides';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'archive';
  if (mimeType.startsWith('text/')) return 'text';
  return 'file';
}

/**
 * Validate files before upload
 */
function validateFiles(files, imageOnly = false) {
  const errors = [];
  const validFiles = [];

  Array.from(files).forEach((file) => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`"${file.name}" exceeds 5 MB limit`);
      return;
    }

    // Check file type
    const allowedTypes = imageOnly ? ALLOWED_IMAGE_TYPES : ALLOWED_ATTACHMENT_TYPES;
    if (!allowedTypes.includes(file.type)) {
      const typeMsg = imageOnly
        ? 'Only JPEG, PNG, GIF, and WebP images are allowed'
        : 'This file type is not allowed';
      errors.push(`"${file.name}": ${typeMsg}`);
      return;
    }

    validFiles.push(file);
  });

  return { validFiles, errors };
}

/**
 * FileUploadZone Component
 * A reusable drag-and-drop file upload zone with cyberpunk styling
 */
function FileUploadZone({
  onFilesSelected,
  multiple = true,
  imageOnly = false,
  disabled = false,
  compact = false,
  showPreview = false,
  className = '',
  children,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
    },
    [disabled, imageOnly, multiple, onFilesSelected, showPreview]
  );

  const handleFileInputChange = useCallback(
    (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFiles(files);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [imageOnly, multiple, onFilesSelected, showPreview]
  );

  const processFiles = useCallback(
    (files) => {
      const filesToProcess = multiple ? files : [files[0]];
      const { validFiles, errors } = validateFiles(filesToProcess, imageOnly);

      if (errors.length > 0) {
        // Report errors via callback if provided
        if (onFilesSelected) {
          onFilesSelected(validFiles, errors);
        }
      } else if (validFiles.length > 0) {
        // Show preview for single image uploads
        if (showPreview && !multiple && validFiles.length === 1 && isImageFile(validFiles[0])) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setPreviewUrl(event.target.result);
            setPreviewError(false);
          };
          reader.onerror = () => {
            setPreviewError(true);
          };
          reader.readAsDataURL(validFiles[0]);
        }

        if (onFilesSelected) {
          onFilesSelected(validFiles, []);
        }
      }
    },
    [imageOnly, multiple, onFilesSelected, showPreview]
  );

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleClearPreview = useCallback((e) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setPreviewError(false);
  }, []);

  const acceptTypes = imageOnly
    ? ALLOWED_IMAGE_TYPES.join(',')
    : ALLOWED_ATTACHMENT_TYPES.join(',');

  return (
    <div
      className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''} ${compact ? 'compact' : ''} ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        multiple={multiple}
        onChange={handleFileInputChange}
        className="file-input-hidden"
        disabled={disabled}
      />

      {showPreview && previewUrl && !previewError ? (
        <div className="file-upload-preview">
          <img src={previewUrl} alt="Preview" onError={() => setPreviewError(true)} />
          <button
            className="file-upload-preview-clear"
            onClick={handleClearPreview}
            title="Clear preview"
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ) : children ? (
        children
      ) : (
        <div className="file-upload-content">
          <div className="file-upload-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="file-upload-text">
            <span className="file-upload-primary">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </span>
            <span className="file-upload-secondary">
              or <span className="file-upload-link">browse</span>
            </span>
          </div>
          <div className="file-upload-hint">
            {imageOnly ? 'JPEG, PNG, GIF, WebP' : 'Images, PDFs, documents'} - Max 5 MB
          </div>
        </div>
      )}

      {isDragging && (
        <div className="file-upload-overlay">
          <div className="file-upload-overlay-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop to upload</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUploadZone;
