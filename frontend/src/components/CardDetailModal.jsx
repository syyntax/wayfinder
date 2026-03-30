import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cardApi, commentApi, checklistApi, attachmentApi, coverApi } from '../utils/api';
import useBoardStore from '../store/boardStore';
import Checklist from './Checklist';
import AttachmentsList from './AttachmentsList';
import FileUploadZone, { formatFileSize } from './FileUploadZone';
import MarkdownRenderer from './MarkdownRenderer';
import './Modal.css';
import './CardDetailModal.css';

function CardDetailModal({ cardId, onClose, labels: boardLabels, members }) {
  const { updateCard, updateCardLabels, updateCardAssignees, deleteCard } = useBoardStore();
  const [card, setCard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [showCoverImagePicker, setShowCoverImagePicker] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageError, setCoverImageError] = useState(false);
  const [coverUploadMode, setCoverUploadMode] = useState('url'); // 'url' or 'upload'
  const [coverUploadFile, setCoverUploadFile] = useState(null);
  const [coverUploadPreview, setCoverUploadPreview] = useState(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Description inline editing state
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionSaveStatus, setDescriptionSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'
  const descriptionTextareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    loadCard();
  }, [cardId]);

  useEffect(() => {
    // Load attachments when card is loaded
    if (card) {
      loadAttachments();
    }
  }, [card?.id]);

  // Auto-save description with debounce
  useEffect(() => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Don't save if we're not in edit mode or if draft matches current description
    if (!isEditingDescription || !card || descriptionDraft === card.description) {
      return;
    }

    // Set a timeout to save after 1.5 seconds of inactivity
    saveTimeoutRef.current = setTimeout(async () => {
      setDescriptionSaveStatus('saving');
      try {
        await updateCard(cardId, { description: descriptionDraft });
        setCard((prev) => ({ ...prev, description: descriptionDraft }));
        setDescription(descriptionDraft);
        setDescriptionSaveStatus('saved');
        // Clear the saved status after 2 seconds
        setTimeout(() => setDescriptionSaveStatus(''), 2000);
      } catch (error) {
        setDescriptionSaveStatus('error');
        toast.error('Failed to save description');
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [descriptionDraft, isEditingDescription, card?.description, cardId, updateCard]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      descriptionTextareaRef.current.focus();
      // Move cursor to end of text
      const length = descriptionTextareaRef.current.value.length;
      descriptionTextareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditingDescription]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const loadCard = async () => {
    setIsLoading(true);
    try {
      const response = await cardApi.getOne(cardId);
      setCard(response.data.card);
      setTitle(response.data.card.title);
      setDescription(response.data.card.description || '');
      setDescriptionDraft(response.data.card.description || '');
      setCoverImageUrl(response.data.card.cover_image || '');
    } catch (error) {
      toast.error('Failed to load card details');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttachments = async () => {
    try {
      const response = await attachmentApi.getForCard(cardId);
      setAttachments(response.data.attachments || []);
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  };

  const handleUpdateTitle = async () => {
    if (title.trim() && title !== card.title) {
      try {
        await updateCard(cardId, { title: title.trim() });
        setCard({ ...card, title: title.trim() });
      } catch (error) {
        toast.error('Failed to update title');
        setTitle(card.title);
      }
    }
    setIsEditing(false);
  };

  const handleUpdateDescription = async () => {
    if (description !== card.description) {
      try {
        await updateCard(cardId, { description });
        setCard({ ...card, description });
        toast.success('Description updated');
      } catch (error) {
        toast.error('Failed to update description');
      }
    }
  };

  // Enter description edit mode
  const handleStartEditingDescription = () => {
    setDescriptionDraft(card.description || '');
    setIsEditingDescription(true);
    setDescriptionSaveStatus('');
  };

  // Exit description edit mode
  const handleStopEditingDescription = async () => {
    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save if there are unsaved changes
    if (descriptionDraft !== card.description) {
      setDescriptionSaveStatus('saving');
      try {
        await updateCard(cardId, { description: descriptionDraft });
        setCard((prev) => ({ ...prev, description: descriptionDraft }));
        setDescription(descriptionDraft);
        setDescriptionSaveStatus('saved');
      } catch (error) {
        setDescriptionSaveStatus('error');
        toast.error('Failed to save description');
        return; // Don't exit edit mode on error
      }
    }

    setIsEditingDescription(false);
    setTimeout(() => setDescriptionSaveStatus(''), 2000);
  };

  // Cancel description editing and revert changes
  const handleCancelEditingDescription = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setDescriptionDraft(card.description || '');
    setIsEditingDescription(false);
    setDescriptionSaveStatus('');
  };

  // Handle keyboard shortcuts in description textarea
  const handleDescriptionKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancelEditingDescription();
    }
  };

  const handleToggleLabel = async (labelId) => {
    const hasLabel = card.labels.some((l) => l.id === labelId);
    try {
      await updateCardLabels(cardId, labelId, hasLabel ? 'remove' : 'add');
      if (hasLabel) {
        setCard({ ...card, labels: card.labels.filter((l) => l.id !== labelId) });
      } else {
        const label = boardLabels.find((l) => l.id === labelId);
        setCard({ ...card, labels: [...card.labels, label] });
      }
    } catch (error) {
      toast.error('Failed to update labels');
    }
  };

  const handleToggleAssignee = async (userId) => {
    const isAssigned = card.assignees.some((a) => a.id === userId);
    try {
      await updateCardAssignees(cardId, userId, isAssigned ? 'remove' : 'add');
      if (isAssigned) {
        setCard({ ...card, assignees: card.assignees.filter((a) => a.id !== userId) });
      } else {
        const member = members.find((m) => m.id === userId);
        setCard({ ...card, assignees: [...card.assignees, member] });
      }
    } catch (error) {
      toast.error('Failed to update assignees');
    }
  };

  const handleSetDueDate = async (dateStr) => {
    try {
      await updateCard(cardId, { dueDate: dateStr || null });
      setCard({ ...card, due_date: dateStr });
      setShowDatePicker(false);
      toast.success('Due date updated');
    } catch (error) {
      toast.error('Failed to update due date');
    }
  };

  const handleSetPriority = async (priority) => {
    try {
      await updateCard(cardId, { priority });
      setCard({ ...card, priority });
    } catch (error) {
      toast.error('Failed to update priority');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const response = await commentApi.create({ cardId, content: newComment.trim() });
      setCard({ ...card, comments: [response.data.comment, ...card.comments] });
      setNewComment('');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleDeleteCard = async () => {
    if (window.confirm('Archive this card?')) {
      try {
        await deleteCard(cardId);
        toast.success('Card archived');
        onClose();
      } catch (error) {
        toast.error('Failed to archive card');
      }
    }
  };

  const handleSetCoverImage = async () => {
    try {
      await updateCard(cardId, { coverImage: coverImageUrl.trim() || null });
      setCard({ ...card, cover_image: coverImageUrl.trim() || null });
      setShowCoverImagePicker(false);
      setCoverImageError(false);
      toast.success('Cover image updated');
    } catch (error) {
      toast.error('Failed to update cover image');
    }
  };

  const handleRemoveCoverImage = async () => {
    try {
      await updateCard(cardId, { coverImage: null });
      setCard({ ...card, cover_image: null });
      setCoverImageUrl('');
      setCoverImageError(false);
      toast.success('Cover image removed');
    } catch (error) {
      toast.error('Failed to remove cover image');
    }
  };

  // Handle cover image file upload
  const handleCoverFileSelect = (files, errors) => {
    if (errors && errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    if (files && files.length > 0) {
      const file = files[0];
      setCoverUploadFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setCoverUploadPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadCoverImage = async () => {
    if (!coverUploadFile) return;

    setIsUploadingCover(true);
    try {
      const response = await coverApi.uploadCardCover(cardId, coverUploadFile);
      const newCoverImage = response.data.coverImage;
      setCard({ ...card, cover_image: newCoverImage });
      setCoverImageUrl(newCoverImage);
      setShowCoverImagePicker(false);
      setCoverUploadFile(null);
      setCoverUploadPreview(null);
      setCoverUploadMode('url');
      // Update the card in the board store so the cover appears on the kanban card
      await updateCard(cardId, { coverImage: newCoverImage });
      toast.success('Cover image uploaded');
    } catch (error) {
      toast.error(error.message || 'Failed to upload cover image');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Drag and drop handlers for the entire modal
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleUploadAttachments(Array.from(files));
    }
  }, [cardId]);

  // Upload attachments
  const handleUploadAttachments = async (files) => {
    if (!files || files.length === 0) return;

    setIsUploadingAttachments(true);
    setUploadProgress(0);

    try {
      const response = await attachmentApi.upload(cardId, files);

      // Add new attachments to the list
      if (response.data?.attachments) {
        setAttachments((prev) => [...response.data.attachments, ...prev]);
      }

      // If a cover image was automatically set, update the card
      if (response.data?.coverImageSet && response.data?.coverImage) {
        setCard((prev) => ({ ...prev, cover_image: response.data.coverImage }));
        setCoverImageUrl(response.data.coverImage);
      }

      toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
    } catch (error) {
      toast.error(error.message || 'Failed to upload files');
    } finally {
      setIsUploadingAttachments(false);
      setUploadProgress(0);
    }
  };

  // Handle attachment selection from FileUploadZone
  const handleAttachmentFilesSelected = (files, errors) => {
    if (errors && errors.length > 0) {
      errors.forEach((err) => toast.error(err));
    }
    if (files && files.length > 0) {
      handleUploadAttachments(files);
    }
  };

  // Handle attachment deletion
  const handleAttachmentDelete = (attachmentId, coverImageCleared) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    if (coverImageCleared) {
      setCard((prev) => ({ ...prev, cover_image: null }));
      setCoverImageUrl('');
    }
  };

  // Set attachment as cover image
  const handleSetAttachmentAsCover = async (attachmentUrl) => {
    try {
      await updateCard(cardId, { coverImage: attachmentUrl });
      setCard({ ...card, cover_image: attachmentUrl });
      setCoverImageUrl(attachmentUrl);
      toast.success('Cover image updated');
    } catch (error) {
      toast.error('Failed to set cover image');
    }
  };

  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    try {
      const response = await checklistApi.create({
        cardId,
        title: newChecklistTitle.trim(),
      });
      setCard({ ...card, checklists: [...(card.checklists || []), response.data.checklist] });
      setNewChecklistTitle('');
      setShowAddChecklist(false);
    } catch (error) {
      toast.error('Failed to add checklist');
    }
  };

  const handleUpdateChecklist = (updatedChecklist) => {
    setCard({
      ...card,
      checklists: card.checklists.map((c) =>
        c.id === updatedChecklist.id ? updatedChecklist : c
      ),
    });
  };

  const handleDeleteChecklist = (checklistId) => {
    setCard({
      ...card,
      checklists: card.checklists.filter((c) => c.id !== checklistId),
    });
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (isLoading) {
    return (
      <div className="modal-backdrop" onClick={handleBackdropClick}>
        <div className="modal-container card-modal">
          <div className="modal-loading">
            <div className="spinner"></div>
            <p>Loading card...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const priorityOptions = [
    { value: 'none', label: 'None', color: 'transparent' },
    { value: 'low', label: 'Low', color: 'var(--color-neon-cyan)' },
    { value: 'medium', label: 'Medium', color: 'var(--color-cyber-purple)' },
    { value: 'high', label: 'High', color: 'var(--color-ember-orange)' },
    { value: 'critical', label: 'Critical', color: 'var(--color-blood-red)' },
  ];

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal-container card-modal large"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Overlay */}
        {isDraggingOver && (
          <div className="drag-overlay-full">
            <div className="drag-overlay-full-content">
              <svg className="drag-overlay-full-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="drag-overlay-full-text">Drop files to attach</span>
              <span className="drag-overlay-full-hint">Files will be attached to this card</span>
            </div>
          </div>
        )}

        {/* Cover Image Banner */}
        {card.cover_image && (
          <div className="card-cover-image">
            <img
              src={card.cover_image}
              alt="Card cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="card-cover-overlay" />
            <button
              className="card-cover-remove"
              onClick={handleRemoveCoverImage}
              title="Remove cover image"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        <div className="modal-header">
          <div className="card-header-content">
            {card.labels.length > 0 && (
              <div className="card-header-labels">
                {card.labels.map((label) => (
                  <span
                    key={label.id}
                    className="header-label"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
            {isEditing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleUpdateTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateTitle();
                  if (e.key === 'Escape') {
                    setTitle(card.title);
                    setIsEditing(false);
                  }
                }}
                autoFocus
                className="card-title-input"
              />
            ) : (
              <h2 className="card-modal-title" onClick={() => setIsEditing(true)}>
                {card.title}
              </h2>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="card-modal-body">
          <div className="card-main">
            {/* Description */}
            <div className="card-section">
              <div className="card-section-header">
                <h3 className="card-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
                  </svg>
                  Description
                </h3>
                {descriptionSaveStatus && (
                  <span className={`description-save-status ${descriptionSaveStatus}`}>
                    {descriptionSaveStatus === 'saving' && (
                      <>
                        <span className="save-spinner" />
                        Saving...
                      </>
                    )}
                    {descriptionSaveStatus === 'saved' && (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Saved
                      </>
                    )}
                    {descriptionSaveStatus === 'error' && (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Error
                      </>
                    )}
                  </span>
                )}
              </div>

              {isEditingDescription ? (
                <div className="description-editor">
                  <textarea
                    ref={descriptionTextareaRef}
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    onKeyDown={handleDescriptionKeyDown}
                    placeholder="Add a more detailed description... (Markdown supported)"
                    className="card-description-input"
                    rows={8}
                  />
                  <div className="description-editor-hint">
                    <span className="markdown-hint">
                      <svg viewBox="0 0 16 16" fill="currentColor">
                        <path d="M14.85 3c.63 0 1.15.52 1.14 1.15v7.7c0 .63-.51 1.15-1.15 1.15H1.15C.52 13 0 12.48 0 11.84V4.15C0 3.52.52 3 1.15 3h13.7zM9 11V5H7l-1.5 2.5L4 5H2v6h2V8l1.5 1.92L7 8v3h2zm2.99.5L14.5 8H13V5h-2v3H9.5l2.49 3.5z" />
                      </svg>
                      Markdown supported
                    </span>
                    <span className="keyboard-hint">
                      Press <kbd>Esc</kbd> to cancel
                    </span>
                  </div>
                  <div className="description-editor-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleStopEditingDescription}
                    >
                      Done
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleCancelEditingDescription}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`description-view ${!card.description ? 'empty' : ''}`}
                  onClick={handleStartEditingDescription}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleStartEditingDescription();
                    }
                  }}
                >
                  {card.description ? (
                    <MarkdownRenderer content={card.description} />
                  ) : (
                    <span className="description-placeholder">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Click to add a description...
                    </span>
                  )}
                  <div className="description-edit-overlay">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Edit
                  </div>
                </div>
              )}
            </div>

            {/* Checklists */}
            {card.checklists && card.checklists.length > 0 && (
              <div className="card-section">
                <h3 className="card-section-title">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Checklists
                </h3>
                <div className="checklists-container">
                  {card.checklists.map((checklist) => (
                    <Checklist
                      key={checklist.id}
                      checklist={checklist}
                      onUpdate={handleUpdateChecklist}
                      onDelete={handleDeleteChecklist}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Attachments */}
            <div className="card-section">
              <h3 className="card-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                </svg>
                Attachments
                {attachments.length > 0 && (
                  <span className="section-count">({attachments.length})</span>
                )}
              </h3>

              {/* Upload Zone */}
              <FileUploadZone
                onFilesSelected={handleAttachmentFilesSelected}
                multiple={true}
                imageOnly={false}
                disabled={isUploadingAttachments}
                compact={true}
                className="card-attachment-upload"
              >
                {isUploadingAttachments ? (
                  <div className="upload-progress-content">
                    <div className="upload-spinner" />
                    <span>Uploading files...</span>
                  </div>
                ) : (
                  <div className="file-upload-content">
                    <div className="file-upload-icon" style={{ width: 32, height: 32 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div className="file-upload-text">
                      <span className="file-upload-primary">Drop files or click to upload</span>
                    </div>
                  </div>
                )}
              </FileUploadZone>

              {/* Attachments List */}
              {attachments.length > 0 && (
                <div className="card-attachments-list">
                  <AttachmentsList
                    attachments={attachments}
                    onDelete={handleAttachmentDelete}
                    onSetCover={handleSetAttachmentAsCover}
                    currentCoverImage={card.cover_image}
                  />
                </div>
              )}
            </div>

            {/* Activity / Comments */}
            <div className="card-section">
              <h3 className="card-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                Activity
              </h3>

              <div className="comment-form">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleAddComment();
                    }
                  }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                >
                  Comment
                </button>
              </div>

              <div className="activity-list">
                {card.comments?.map((comment) => (
                  <div key={comment.id} className="activity-item comment">
                    <div className="activity-avatar">
                      {comment.avatar_url ? (
                        <img src={comment.avatar_url} alt={comment.display_name} />
                      ) : (
                        <span>{(comment.display_name || comment.username)[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-author">{comment.display_name || comment.username}</span>
                        <span className="activity-time">
                          {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <p className="comment-text">{comment.content}</p>
                    </div>
                  </div>
                ))}

                {card.activity?.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-avatar small">
                      {activity.avatar_url ? (
                        <img src={activity.avatar_url} alt={activity.display_name || activity.username} />
                      ) : (
                        <span>{(activity.display_name || activity.username)[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="activity-content">
                      <span className="activity-text">
                        <strong>{activity.display_name || activity.username}</strong>
                        {' '}{formatActivityAction(activity)}
                      </span>
                      <span className="activity-time">
                        {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card-sidebar">
            {/* Labels */}
            <div className="card-section">
              <h3 className="card-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Labels
              </h3>
              <button className="sidebar-button" onClick={() => setShowLabelPicker(!showLabelPicker)}>
                {card.labels.length > 0 ? (
                  <div className="label-preview">
                    {card.labels.slice(0, 3).map((l) => (
                      <span key={l.id} className="label-dot" style={{ backgroundColor: l.color }} />
                    ))}
                    {card.labels.length > 3 && <span>+{card.labels.length - 3}</span>}
                  </div>
                ) : (
                  'Add labels'
                )}
              </button>
              {showLabelPicker && (
                <div className="picker-dropdown">
                  {boardLabels.map((label) => (
                    <button
                      key={label.id}
                      className={`picker-option ${card.labels.some((l) => l.id === label.id) ? 'selected' : ''}`}
                      onClick={() => handleToggleLabel(label.id)}
                    >
                      <span className="label-color" style={{ backgroundColor: label.color }} />
                      <span className="label-name">{label.name || 'Unnamed'}</span>
                      {card.labels.some((l) => l.id === label.id) && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="check-icon">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Members */}
            <div className="card-section">
              <h3 className="card-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                Members
              </h3>
              <button className="sidebar-button" onClick={() => setShowMemberPicker(!showMemberPicker)}>
                {card.assignees.length > 0 ? (
                  <div className="member-preview">
                    {card.assignees.slice(0, 3).map((a) => (
                      <span key={a.id} className="member-initial">
                        {(a.display_name || a.username)[0].toUpperCase()}
                      </span>
                    ))}
                    {card.assignees.length > 3 && <span>+{card.assignees.length - 3}</span>}
                  </div>
                ) : (
                  'Add members'
                )}
              </button>
              {showMemberPicker && (
                <div className="picker-dropdown">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      className={`picker-option ${card.assignees.some((a) => a.id === member.id) ? 'selected' : ''}`}
                      onClick={() => handleToggleAssignee(member.id)}
                    >
                      <span className="member-avatar-small">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.display_name || member.username} />
                        ) : (
                          (member.display_name || member.username)[0].toUpperCase()
                        )}
                      </span>
                      <span className="member-name">{member.display_name || member.username}</span>
                      {card.assignees.some((a) => a.id === member.id) && (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="check-icon">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Due Date */}
            <div className="card-section">
              <h3 className="card-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Due Date
              </h3>
              <button className="sidebar-button" onClick={() => setShowDatePicker(!showDatePicker)}>
                {card.due_date ? format(new Date(card.due_date), 'MMM d, yyyy') : 'Set due date'}
              </button>
              {showDatePicker && (
                <div className="picker-dropdown date-picker">
                  <input
                    type="datetime-local"
                    value={card.due_date ? card.due_date.slice(0, 16) : ''}
                    onChange={(e) => handleSetDueDate(e.target.value ? new Date(e.target.value).toISOString() : null)}
                  />
                  {card.due_date && (
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSetDueDate(null)}>
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="card-section">
              <h3 className="card-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                </svg>
                Priority
              </h3>
              <div className="priority-options">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    className={`priority-option ${card.priority === opt.value ? 'selected' : ''}`}
                    style={{ '--priority-color': opt.color }}
                    onClick={() => handleSetPriority(opt.value)}
                  >
                    <span className="priority-indicator" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cover Image */}
            <div className="card-section">
              <h3 className="card-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                Cover Image
              </h3>
              {showCoverImagePicker ? (
                <div className="cover-image-picker">
                  {/* Mode Toggle */}
                  <div className="cover-mode-toggle">
                    <button
                      className={`cover-mode-btn ${coverUploadMode === 'url' ? 'active' : ''}`}
                      onClick={() => setCoverUploadMode('url')}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                      </svg>
                      URL
                    </button>
                    <button
                      className={`cover-mode-btn ${coverUploadMode === 'upload' ? 'active' : ''}`}
                      onClick={() => setCoverUploadMode('upload')}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      Upload
                    </button>
                  </div>

                  {coverUploadMode === 'url' ? (
                    <>
                      <input
                        type="url"
                        value={coverImageUrl}
                        onChange={(e) => {
                          setCoverImageUrl(e.target.value);
                          setCoverImageError(false);
                        }}
                        placeholder="Paste image URL..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSetCoverImage();
                          if (e.key === 'Escape') {
                            setShowCoverImagePicker(false);
                            setCoverImageUrl(card.cover_image || '');
                          }
                        }}
                      />
                      {coverImageUrl && !coverImageError && (
                        <div className="cover-image-mini-preview">
                          <img
                            src={coverImageUrl}
                            alt="Cover preview"
                            onError={() => setCoverImageError(true)}
                          />
                        </div>
                      )}
                      {coverImageError && (
                        <div className="cover-image-url-error">
                          Invalid image URL
                        </div>
                      )}
                      <div className="cover-image-picker-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleSetCoverImage}
                          disabled={coverImageError}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setShowCoverImagePicker(false);
                            setCoverImageUrl(card.cover_image || '');
                            setCoverImageError(false);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <FileUploadZone
                        onFilesSelected={handleCoverFileSelect}
                        multiple={false}
                        imageOnly={true}
                        disabled={isUploadingCover}
                        compact={true}
                        showPreview={true}
                        className="cover-upload-zone"
                      />
                      {coverUploadPreview && (
                        <div className="cover-image-mini-preview">
                          <img src={coverUploadPreview} alt="Cover preview" />
                          <button
                            className="cover-preview-clear"
                            onClick={() => {
                              setCoverUploadFile(null);
                              setCoverUploadPreview(null);
                            }}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      )}
                      <div className="cover-image-picker-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleUploadCoverImage}
                          disabled={!coverUploadFile || isUploadingCover}
                        >
                          {isUploadingCover ? 'Uploading...' : 'Upload'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setShowCoverImagePicker(false);
                            setCoverUploadFile(null);
                            setCoverUploadPreview(null);
                            setCoverUploadMode('url');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  className="sidebar-button"
                  onClick={() => setShowCoverImagePicker(true)}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                  </svg>
                  {card.cover_image ? 'Change cover' : 'Add cover image'}
                </button>
              )}
            </div>

            {/* Checklist */}
            <div className="card-section">
              <h3 className="card-section-title">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Checklist
              </h3>
              {showAddChecklist ? (
                <div className="add-checklist-form">
                  <input
                    type="text"
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Checklist title..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddChecklist();
                      if (e.key === 'Escape') {
                        setShowAddChecklist(false);
                        setNewChecklistTitle('');
                      }
                    }}
                  />
                  <div className="add-checklist-actions">
                    <button className="btn btn-primary btn-sm" onClick={handleAddChecklist}>
                      Add
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setShowAddChecklist(false);
                        setNewChecklistTitle('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="sidebar-button" onClick={() => setShowAddChecklist(true)}>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                  </svg>
                  Add checklist
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="card-section">
              <h3 className="card-section-title">Actions</h3>
              <button className="sidebar-button danger" onClick={handleDeleteCard}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Archive
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatActivityAction(activity) {
  const data = activity.action_data ? JSON.parse(activity.action_data) : {};

  switch (activity.action_type) {
    case 'card_created':
      return 'created this card';
    case 'card_moved':
      return `moved this card from ${data.from} to ${data.to}`;
    case 'card_updated':
      return 'updated this card';
    case 'comment_added':
      return 'commented on this card';
    case 'assignee_added':
      return `assigned ${data.assignee}`;
    case 'assignee_removed':
      return `unassigned ${data.assignee}`;
    default:
      return activity.action_type.replace(/_/g, ' ');
  }
}

export default CardDetailModal;
