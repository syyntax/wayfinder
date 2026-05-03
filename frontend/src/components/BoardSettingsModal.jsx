import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { boardApi, labelApi, coverApi } from '../utils/api';
import useBoardStore from '../store/boardStore';
import useAuthStore from '../store/authStore';
import FileUploadZone from './FileUploadZone';
import BoardImportPreview from './BoardImportPreview';
import './BoardSettingsModal.css';

const THEME_OPTIONS = [
  { id: 'cyber-purple', name: 'Cyber Purple', color: '#8b3daf' },
  { id: 'neon-cyan', name: 'Neon Cyan', color: '#06b6d4' },
  { id: 'magenta-pink', name: 'Magenta Pink', color: '#ec4899' },
  { id: 'ember-orange', name: 'Ember Orange', color: '#f97316' },
  { id: 'toxic-green', name: 'Toxic Green', color: '#10b981' },
  { id: 'blood-red', name: 'Blood Red', color: '#dc2626' },
];

const PRESET_COLORS = [
  '#dc2626', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#78716c', '#64748b'
];

function BoardSettingsModal({ board, onClose, onUpdate }) {
  const { labels, setLabels, priorities, setPriorities } = useBoardStore();
  const { selectedWorkspace } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || '');
  const [visibility, setVisibility] = useState(board.visibility || 'private');
  const [backgroundTheme, setBackgroundTheme] = useState(board.background_theme || 'cyber-purple');
  const [coverImage, setCoverImage] = useState(board.cover_image || '');
  const [coverImagePreviewError, setCoverImagePreviewError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Animation state for slide-in/slide-out
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Cover upload state
  const [coverUploadMode, setCoverUploadMode] = useState('url'); // 'url' or 'upload'
  const [coverUploadFile, setCoverUploadFile] = useState(null);
  const [coverUploadPreview, setCoverUploadPreview] = useState(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Label management state
  const [editingLabel, setEditingLabel] = useState(null);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#8b5cf6');
  const [showNewLabel, setShowNewLabel] = useState(false);

  // Priority management state
  const [editingPriorities, setEditingPriorities] = useState(null);
  const [isSavingPriorities, setIsSavingPriorities] = useState(false);
  const [newPriorityLabel, setNewPriorityLabel] = useState('');
  const [newPriorityColor, setNewPriorityColor] = useState('#8b5cf6');
  const [openPriorityColorIdx, setOpenPriorityColorIdx] = useState(null);

  // Import/Export state
  const [exportOptions, setExportOptions] = useState({
    includeComments: true,
    includeChecklists: true,
    includeAttachments: true
  });
  const [isExporting, setIsExporting] = useState(false);
  const [importMode, setImportMode] = useState('new'); // 'new' or 'merge'
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileInputRef = useRef(null);

  // Trigger slide-in animation on mount
  useEffect(() => {
    // Small delay to ensure the initial state is rendered first
    const timer = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // When opening the priorities tab, snapshot the current priorities into a
  // local editing copy so changes can be discarded without affecting the
  // global store until saved.
  useEffect(() => {
    if (activeTab === 'priorities' && editingPriorities === null) {
      setEditingPriorities(priorities.map(p => ({ ...p })));
    }
  }, [activeTab, priorities, editingPriorities]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setIsVisible(false);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 300); // Match the CSS transition duration
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const handleSaveGeneral = async () => {
    if (!name.trim()) {
      toast.error('Board name is required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await boardApi.update(board.id, {
        name: name.trim(),
        description: description.trim(),
        visibility,
        backgroundTheme,
        coverImage: coverImage.trim() || null,
      });
      onUpdate(response.data.board);
      toast.success('Board settings updated');
    } catch (error) {
      toast.error('Failed to update board settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverImageChange = (url) => {
    setCoverImage(url);
    setCoverImagePreviewError(false);
  };

  const handleRemoveCoverImage = async () => {
    setIsSaving(true);
    try {
      const response = await boardApi.update(board.id, {
        coverImage: null,
      });
      setCoverImage('');
      onUpdate(response.data.board);
      toast.success('Cover image removed');
    } catch (error) {
      toast.error('Failed to remove cover image');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cover file selection
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
      const response = await coverApi.uploadBoardCover(board.id, coverUploadFile);
      setCoverImage(response.data.coverImage);
      onUpdate(response.data.board);
      setCoverUploadFile(null);
      setCoverUploadPreview(null);
      toast.success('Cover image uploaded');
    } catch (error) {
      toast.error(error.message || 'Failed to upload cover image');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) {
      toast.error('Label name is required');
      return;
    }

    try {
      const response = await labelApi.create({
        boardId: board.id,
        name: newLabelName.trim(),
        color: newLabelColor,
      });
      setLabels([...labels, response.data.label]);
      setNewLabelName('');
      setNewLabelColor('#8b5cf6');
      setShowNewLabel(false);
      toast.success('Label created');
    } catch (error) {
      toast.error('Failed to create label');
    }
  };

  const handleUpdateLabel = async (labelId) => {
    if (!editingLabel.name.trim()) {
      toast.error('Label name is required');
      return;
    }

    try {
      const response = await labelApi.update(labelId, {
        name: editingLabel.name.trim(),
        color: editingLabel.color,
      });
      setLabels(labels.map(l => l.id === labelId ? response.data.label : l));
      setEditingLabel(null);
      toast.success('Label updated');
    } catch (error) {
      toast.error('Failed to update label');
    }
  };

  const handleDeleteLabel = async (labelId) => {
    if (!window.confirm('Delete this label? It will be removed from all cards.')) return;

    try {
      await labelApi.delete(labelId);
      setLabels(labels.filter(l => l.id !== labelId));
      toast.success('Label deleted');
    } catch (error) {
      toast.error('Failed to delete label');
    }
  };

  // ----- Priority management helpers -----

  // Generate a slug-like value from a label, ensuring uniqueness within the
  // current editing list.
  const generatePriorityValue = (label, existing) => {
    const base = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'priority';
    const taken = new Set(existing.map(p => p.value));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  };

  const handleEditPriorityLabel = (idx, value) => {
    setEditingPriorities(prev =>
      prev.map((p, i) => (i === idx ? { ...p, label: value } : p))
    );
  };

  const handleEditPriorityColor = (idx, color) => {
    setEditingPriorities(prev =>
      prev.map((p, i) => (i === idx ? { ...p, color } : p))
    );
  };

  const handleDeletePriority = (idx) => {
    setEditingPriorities(prev => {
      const target = prev[idx];
      if (target?.value === 'none') return prev; // never delete 'none'
      return prev.filter((_, i) => i !== idx);
    });
    setOpenPriorityColorIdx(null);
  };

  const handleAddPriority = () => {
    const label = newPriorityLabel.trim();
    if (!label) {
      toast.error('Priority label is required');
      return;
    }
    const list = editingPriorities || [];
    const value = generatePriorityValue(label, list);
    setEditingPriorities([
      ...list,
      { value, label, color: newPriorityColor, position: list.length },
    ]);
    setNewPriorityLabel('');
    setNewPriorityColor('#8b5cf6');
  };

  const handleSavePriorities = async () => {
    const list = editingPriorities || [];
    // Need at least 'none' plus one real priority
    const nonNoneCount = list.filter(p => p.value !== 'none').length;
    if (nonNoneCount < 1) {
      toast.error('At least one priority other than None is required');
      return;
    }
    // Validate labels are non-empty
    if (list.some(p => !p.label || !p.label.trim())) {
      toast.error('All priorities must have a label');
      return;
    }

    setIsSavingPriorities(true);
    try {
      const payload = list.map((p, idx) => ({
        value: p.value,
        label: p.label.trim(),
        color: p.color,
        position: idx,
      }));
      const response = await boardApi.updatePriorities(board.id, payload);
      const saved = response.data.priorities || [];
      setPriorities(saved);
      setEditingPriorities(saved.map(p => ({ ...p })));
      setOpenPriorityColorIdx(null);
      toast.success('Priorities updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update priorities');
    } finally {
      setIsSavingPriorities(false);
    }
  };

  const handleResetPriorities = () => {
    setEditingPriorities(priorities.map(p => ({ ...p })));
    setOpenPriorityColorIdx(null);
  };

  // Export board handler
  const handleExportBoard = async () => {
    setIsExporting(true);
    try {
      const result = await boardApi.exportBoard(board.id, exportOptions);

      // Create and trigger download
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Board exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error.message || 'Failed to export board');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle import file selection
  const handleImportFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setImportFile(file);

    // Read and parse the file
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setImportData(data);

      // Get preview from backend
      setIsLoadingPreview(true);
      const previewResult = await boardApi.previewImport(data);
      setImportPreview(previewResult.data);
    } catch (error) {
      console.error('Import file parse error:', error);
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON file format');
      } else {
        toast.error(error.message || 'Failed to read import file');
      }
      setImportFile(null);
      setImportData(null);
      setImportPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Clear import selection
  const handleClearImport = () => {
    setImportFile(null);
    setImportData(null);
    setImportPreview(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  };

  // Execute import
  const handleImport = async () => {
    if (!importData || !selectedWorkspace) return;

    setIsImporting(true);
    try {
      let result;
      if (importMode === 'merge') {
        result = await boardApi.mergeBoard(board.id, importData);
      } else {
        result = await boardApi.importBoard(selectedWorkspace.id, importData);
      }

      const { stats, warnings } = result.data;

      // Show success message with stats
      toast.success(
        `Imported ${stats.listsImported} lists, ${stats.cardsImported} cards, ${stats.labelsImported} labels`,
        { duration: 4000 }
      );

      // Show warnings if any
      if (warnings && warnings.length > 0) {
        setTimeout(() => {
          toast(warnings[0], { icon: 'Warning', duration: 5000 });
        }, 500);
      }

      // If created new board, navigate to it
      if (importMode === 'new' && result.data.board) {
        handleClose();
        navigate(`/board/${result.data.board.id}`);
      } else {
        // Reload current board data
        window.location.reload();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import board');
    } finally {
      setIsImporting(false);
    }
  };

  // Handle drag and drop for import
  const handleImportDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (file) {
      // Create a fake event to reuse the file select handler
      const fakeEvent = { target: { files: [file] } };
      handleImportFileSelect(fakeEvent);
    }
  };

  const handleImportDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Use createPortal to render at document body level to avoid stacking context issues
  return createPortal(
    <div
      className={`board-settings-backdrop ${isVisible ? 'visible' : ''} ${isClosing ? 'closing' : ''}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-settings-title"
    >
      <div
        className={`board-settings-pane ${isVisible ? 'visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pane-header">
          <h2 id="board-settings-title">Board Settings</h2>
          <button
            className="pane-close"
            onClick={handleClose}
            aria-label="Close settings"
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            General
          </button>
          <button
            className={`settings-tab ${activeTab === 'cover' ? 'active' : ''}`}
            onClick={() => setActiveTab('cover')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            Cover
          </button>
          <button
            className={`settings-tab ${activeTab === 'labels' ? 'active' : ''}`}
            onClick={() => setActiveTab('labels')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Labels
          </button>
          <button
            className={`settings-tab ${activeTab === 'theme' ? 'active' : ''}`}
            onClick={() => setActiveTab('theme')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
            </svg>
            Theme
          </button>
          <button
            className={`settings-tab ${activeTab === 'priorities' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('priorities');
              setEditingPriorities(priorities.map(p => ({ ...p })));
              setOpenPriorityColorIdx(null);
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
            </svg>
            Priorities
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-panel">
              <div className="form-group">
                <label>Board Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter board name"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description (optional)"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Visibility</label>
                <div className="visibility-options">
                  <button
                    className={`visibility-option ${visibility === 'private' ? 'active' : ''}`}
                    onClick={() => setVisibility('private')}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <div className="visibility-info">
                      <span className="visibility-name">Private</span>
                      <span className="visibility-desc">Only workspace members can see</span>
                    </div>
                  </button>
                  <button
                    className={`visibility-option ${visibility === 'workspace' ? 'active' : ''}`}
                    onClick={() => setVisibility('workspace')}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <div className="visibility-info">
                      <span className="visibility-name">Workspace</span>
                      <span className="visibility-desc">All workspace members can edit</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleSaveGeneral}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              {/* Import/Export Section */}
              <div className="settings-section-divider" />

              <div className="import-export-inline-section">
                {/* Export Section */}
                <div className="import-export-section">
                  <div className="section-header">
                    <div className="section-icon export">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="section-title">
                      <h4>Export Board</h4>
                      <p>Download a complete backup of this board as JSON</p>
                    </div>
                  </div>

                  <div className="export-options">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeComments}
                        onChange={(e) => setExportOptions({ ...exportOptions, includeComments: e.target.checked })}
                      />
                      <span className="checkbox-custom" />
                      <span className="checkbox-label">Include comments</span>
                    </label>
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeChecklists}
                        onChange={(e) => setExportOptions({ ...exportOptions, includeChecklists: e.target.checked })}
                      />
                      <span className="checkbox-custom" />
                      <span className="checkbox-label">Include checklists</span>
                    </label>
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeAttachments}
                        onChange={(e) => setExportOptions({ ...exportOptions, includeAttachments: e.target.checked })}
                      />
                      <span className="checkbox-custom" />
                      <span className="checkbox-label">Include attachment metadata</span>
                    </label>
                  </div>

                  <button
                    className="btn btn-primary export-btn"
                    onClick={handleExportBoard}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <>
                        <span className="btn-spinner" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Export Board
                      </>
                    )}
                  </button>
                </div>

                <div className="section-divider" />

                {/* Import Section */}
                <div className="import-export-section">
                  <div className="section-header">
                    <div className="section-icon import">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="section-title">
                      <h4>Import Board</h4>
                      <p>Restore a board from a JSON export file</p>
                    </div>
                  </div>

                  {!importPreview ? (
                    <>
                      {/* Import Mode Selection */}
                      <div className="import-mode-options">
                        <label className={`import-mode-option ${importMode === 'new' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="importMode"
                            value="new"
                            checked={importMode === 'new'}
                            onChange={() => setImportMode('new')}
                          />
                          <span className="radio-custom" />
                          <div className="mode-info">
                            <span className="mode-name">Create new board</span>
                            <span className="mode-desc">Import as a separate board in this workspace</span>
                          </div>
                        </label>
                        <label className={`import-mode-option ${importMode === 'merge' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="importMode"
                            value="merge"
                            checked={importMode === 'merge'}
                            onChange={() => setImportMode('merge')}
                          />
                          <span className="radio-custom" />
                          <div className="mode-info">
                            <span className="mode-name">Merge into current board</span>
                            <span className="mode-desc">Append lists and cards to this board</span>
                          </div>
                        </label>
                      </div>

                      {/* File Drop Zone */}
                      <div
                        className={`import-dropzone ${importFile ? 'has-file' : ''}`}
                        onDrop={handleImportDrop}
                        onDragOver={handleImportDragOver}
                        onClick={() => importFileInputRef.current?.click()}
                      >
                        <input
                          ref={importFileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleImportFileSelect}
                          style={{ display: 'none' }}
                        />
                        {isLoadingPreview ? (
                          <div className="dropzone-loading">
                            <span className="loading-spinner" />
                            <span>Processing file...</span>
                          </div>
                        ) : importFile ? (
                          <div className="dropzone-file">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <span className="file-name">{importFile.name}</span>
                            <button
                              className="file-clear"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearImport();
                              }}
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="dropzone-empty">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <span className="dropzone-text">Drop JSON file here or click to browse</span>
                            <span className="dropzone-hint">Maximum file size: 10MB</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Import Preview */
                    <BoardImportPreview
                      previewData={importPreview}
                      importMode={importMode}
                      onImport={handleImport}
                      onCancel={handleClearImport}
                      isImporting={isImporting}
                    />
                  )}

                  {/* Attachment Warning */}
                  <div className="import-warning">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>
                      Attachments are not included in exports. After importing, you will need to re-upload any attached files.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cover' && (
            <div className="settings-panel">
              <div className="form-group">
                <label>Cover Image</label>
                <p className="form-help">Add a cover image to display as a banner on your board</p>

                {/* Cover Image Preview */}
                {coverImage && !coverImagePreviewError && (
                  <div className="cover-image-preview">
                    <div className="cover-image-container">
                      <img
                        src={coverImage}
                        alt="Board cover preview"
                        onError={() => setCoverImagePreviewError(true)}
                      />
                      <div className="cover-image-overlay" />
                    </div>
                    <button
                      className="cover-remove-btn"
                      onClick={handleRemoveCoverImage}
                      disabled={isSaving || isUploadingCover}
                      title="Remove cover image"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}

                {coverImagePreviewError && coverImage && (
                  <div className="cover-image-error">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Failed to load image. Please check the URL.</span>
                  </div>
                )}

                {/* No Cover Image State */}
                {!coverImage && !coverUploadPreview && (
                  <div className="cover-image-empty">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    <span>No cover image set</span>
                  </div>
                )}

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
                      value={coverImage}
                      onChange={(e) => handleCoverImageChange(e.target.value)}
                      placeholder="Paste an image URL..."
                      className="cover-image-input"
                    />

                    <p className="form-hint">
                      Tip: Use images with a 16:9 aspect ratio for best results
                    </p>

                    <div className="form-actions">
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveGeneral}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save Cover Image'}
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
                      className="board-cover-upload-zone"
                    />

                    {coverUploadPreview && (
                      <div className="cover-upload-preview">
                        <div className="cover-upload-preview-container">
                          <img src={coverUploadPreview} alt="Cover preview" />
                        </div>
                        <button
                          className="cover-upload-preview-clear"
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

                    <p className="form-hint">
                      JPEG, PNG, GIF, WebP - Max 5 MB
                    </p>

                    <div className="form-actions">
                      <button
                        className="btn btn-primary"
                        onClick={handleUploadCoverImage}
                        disabled={!coverUploadFile || isUploadingCover}
                      >
                        {isUploadingCover ? 'Uploading...' : 'Upload Cover Image'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'labels' && (
            <div className="settings-panel">
              <div className="labels-header">
                <p className="labels-description">
                  Create and manage labels for this board. Labels help categorize and filter cards.
                </p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowNewLabel(true)}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                  </svg>
                  New Label
                </button>
              </div>

              {showNewLabel && (
                <div className="label-edit-form">
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Label name"
                    autoFocus
                  />
                  <div className="color-picker">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        className={`color-swatch ${newLabelColor === color ? 'selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => setNewLabelColor(color)}
                      />
                    ))}
                  </div>
                  <div className="label-preview" style={{ background: newLabelColor }}>
                    {newLabelName || 'Label preview'}
                  </div>
                  <div className="label-edit-actions">
                    <button className="btn btn-primary btn-sm" onClick={handleCreateLabel}>
                      Create
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setShowNewLabel(false);
                        setNewLabelName('');
                        setNewLabelColor('#8b5cf6');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="labels-list">
                {labels.map(label => (
                  <div key={label.id} className="label-item">
                    {editingLabel?.id === label.id ? (
                      <div className="label-edit-form inline">
                        <input
                          type="text"
                          value={editingLabel.name}
                          onChange={(e) => setEditingLabel({ ...editingLabel, name: e.target.value })}
                          autoFocus
                        />
                        <div className="color-picker compact">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              className={`color-swatch ${editingLabel.color === color ? 'selected' : ''}`}
                              style={{ background: color }}
                              onClick={() => setEditingLabel({ ...editingLabel, color })}
                            />
                          ))}
                        </div>
                        <div className="label-edit-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleUpdateLabel(label.id)}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditingLabel(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="label-color-bar"
                          style={{ background: label.color }}
                        />
                        <span className="label-name">{label.name}</span>
                        <div className="label-actions">
                          <button
                            className="label-action-btn"
                            onClick={() => setEditingLabel({ ...label })}
                            title="Edit label"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            className="label-action-btn danger"
                            onClick={() => handleDeleteLabel(label.id)}
                            title="Delete label"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {labels.length === 0 && !showNewLabel && (
                  <div className="empty-labels">
                    <p>No labels yet. Create your first label to start organizing cards.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="settings-panel">
              <div className="form-group">
                <label>Board Theme</label>
                <p className="form-help">Choose a color theme for this board</p>
                <div className="theme-options">
                  {THEME_OPTIONS.map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option ${backgroundTheme === theme.id ? 'active' : ''}`}
                      onClick={() => setBackgroundTheme(theme.id)}
                    >
                      <div
                        className="theme-preview"
                        style={{
                          background: `linear-gradient(135deg, ${theme.color}40, ${theme.color}20)`,
                          borderColor: backgroundTheme === theme.id ? theme.color : 'transparent'
                        }}
                      >
                        <div className="theme-accent" style={{ background: theme.color }} />
                      </div>
                      <span className="theme-name">{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleSaveGeneral}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Apply Theme'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'priorities' && (
            <div className="settings-panel">
              <div className="labels-header">
                <p className="labels-description">
                  Customize the priority levels available on this board. Rename, recolor,
                  add, or remove priorities. The "None" priority is required and cannot be removed.
                </p>
              </div>

              <div className="priorities-list">
                {(editingPriorities || []).map((p, idx) => {
                  const isNone = p.value === 'none';
                  const isColorOpen = openPriorityColorIdx === idx;
                  return (
                    <div key={`${p.value}-${idx}`} className="priority-item">
                      <div className="priority-item-row">
                        <button
                          type="button"
                          className="priority-swatch"
                          style={{
                            background: isNone ? 'transparent' : p.color,
                            borderStyle: isNone ? 'dashed' : 'solid',
                          }}
                          onClick={() => setOpenPriorityColorIdx(isColorOpen ? null : idx)}
                          disabled={isNone}
                          title={isNone ? 'None has no color' : 'Change color'}
                          aria-label="Change priority color"
                        />
                        <input
                          type="text"
                          className="priority-label-input"
                          value={p.label}
                          onChange={(e) => handleEditPriorityLabel(idx, e.target.value)}
                          placeholder="Priority name"
                          maxLength={50}
                        />
                        {!isNone ? (
                          <button
                            className="label-action-btn danger"
                            onClick={() => handleDeletePriority(idx)}
                            title="Delete priority"
                            aria-label="Delete priority"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            className="label-action-btn"
                            disabled
                            title="The None priority cannot be removed"
                            aria-label="None cannot be removed"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {isColorOpen && !isNone && (
                        <div className="color-picker compact priority-color-picker">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              className={`color-swatch ${p.color === color ? 'selected' : ''}`}
                              style={{ background: color }}
                              onClick={() => {
                                handleEditPriorityColor(idx, color);
                                setOpenPriorityColorIdx(null);
                              }}
                              title={color}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="label-edit-form priority-add-form">
                <div className="form-group">
                  <label>Add a Priority</label>
                  <input
                    type="text"
                    value={newPriorityLabel}
                    onChange={(e) => setNewPriorityLabel(e.target.value)}
                    placeholder="e.g. Urgent, Wishlist, Blocker..."
                    maxLength={50}
                  />
                </div>
                <div className="color-picker">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      className={`color-swatch ${newPriorityColor === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => setNewPriorityColor(color)}
                    />
                  ))}
                </div>
                <div className="label-edit-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAddPriority}
                    disabled={!newPriorityLabel.trim()}
                  >
                    Add Priority
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-ghost"
                  onClick={handleResetPriorities}
                  disabled={isSavingPriorities}
                >
                  Reset
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSavePriorities}
                  disabled={isSavingPriorities}
                >
                  {isSavingPriorities ? 'Saving...' : 'Save Priorities'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}

export default BoardSettingsModal;
