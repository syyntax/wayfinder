import { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { attachmentApi } from '../utils/api';
import { formatFileSize, getFileIcon, isImageFile } from './FileUploadZone';
import './AttachmentsList.css';

/**
 * Get the display URL for an attachment
 */
function getAttachmentUrl(attachment) {
  return `/api/uploads/attachments/${attachment.stored_filename}`;
}

/**
 * Check if an attachment is an image based on mime type
 */
function isImageAttachment(attachment) {
  return attachment.mime_type && attachment.mime_type.startsWith('image/');
}

/**
 * AttachmentsList Component
 * Displays a list of file attachments with download, view, and delete options
 */
function AttachmentsList({ attachments, onDelete, onSetCover, currentCoverImage }) {
  const [deletingId, setDeletingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Delete "${attachment.filename}"?`)) return;

    setDeletingId(attachment.id);
    try {
      const response = await attachmentApi.delete(attachment.id);
      if (onDelete) {
        onDelete(attachment.id, response.data?.coverImageCleared);
      }
      toast.success('Attachment deleted');
    } catch (error) {
      toast.error(error.message || 'Failed to delete attachment');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (attachment) => {
    const url = getAttachmentUrl(attachment);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (attachment) => {
    if (isImageAttachment(attachment)) {
      setPreviewImage(attachment);
    } else {
      // For non-images, open in new tab
      window.open(getAttachmentUrl(attachment), '_blank');
    }
  };

  const handleSetAsCover = (attachment) => {
    if (onSetCover && isImageAttachment(attachment)) {
      onSetCover(getAttachmentUrl(attachment));
    }
  };

  const isCoverImage = (attachment) => {
    const attachmentUrl = getAttachmentUrl(attachment);
    return currentCoverImage === attachmentUrl;
  };

  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachments-list">
      {attachments.map((attachment) => {
        const isImage = isImageAttachment(attachment);
        const fileIcon = getFileIcon(attachment.mime_type);
        const isDeleting = deletingId === attachment.id;
        const isCover = isCoverImage(attachment);

        return (
          <div
            key={attachment.id}
            className={`attachment-item ${isDeleting ? 'deleting' : ''} ${isCover ? 'is-cover' : ''}`}
          >
            {/* Thumbnail / Icon */}
            <div
              className={`attachment-thumbnail ${isImage ? 'image' : fileIcon}`}
              onClick={() => handlePreview(attachment)}
            >
              {isImage ? (
                <img
                  src={getAttachmentUrl(attachment)}
                  alt={attachment.filename}
                  loading="lazy"
                />
              ) : (
                <FileTypeIcon type={fileIcon} />
              )}
              {isCover && (
                <div className="attachment-cover-badge" title="Current cover image">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="attachment-info">
              <div className="attachment-name" title={attachment.filename}>
                {attachment.filename}
              </div>
              <div className="attachment-meta">
                <span className="attachment-size">{formatFileSize(attachment.file_size)}</span>
                <span className="attachment-separator">-</span>
                <span className="attachment-date">
                  {format(new Date(attachment.uploaded_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="attachment-actions">
              {isImage && !isCover && onSetCover && (
                <button
                  className="attachment-action"
                  onClick={() => handleSetAsCover(attachment)}
                  title="Set as cover image"
                  disabled={isDeleting}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              <button
                className="attachment-action"
                onClick={() => handleDownload(attachment)}
                title="Download"
                disabled={isDeleting}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                className="attachment-action danger"
                onClick={() => handleDelete(attachment)}
                title="Delete"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <div className="attachment-action-spinner" />
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        );
      })}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="attachment-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="attachment-preview-content" onClick={(e) => e.stopPropagation()}>
            <img src={getAttachmentUrl(previewImage)} alt={previewImage.filename} />
            <div className="attachment-preview-info">
              <span className="attachment-preview-name">{previewImage.filename}</span>
              <span className="attachment-preview-size">
                {formatFileSize(previewImage.file_size)}
              </span>
            </div>
            <button
              className="attachment-preview-close"
              onClick={() => setPreviewImage(null)}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="attachment-preview-actions">
              <button onClick={() => handleDownload(previewImage)}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download
              </button>
              {onSetCover && !isCoverImage(previewImage) && (
                <button onClick={() => {
                  handleSetAsCover(previewImage);
                  setPreviewImage(null);
                }}>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  Set as Cover
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * File type icon component
 */
function FileTypeIcon({ type }) {
  const icons = {
    image: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
    pdf: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M10 12h4M10 16h4M8 12v4" />
      </svg>
    ),
    doc: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    sheet: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <line x1="12" y1="9" x2="12" y2="21" />
      </svg>
    ),
    slides: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    archive: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
    text: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
    file: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  };

  return icons[type] || icons.file;
}

export default AttachmentsList;
