import { useState } from 'react';
import toast from 'react-hot-toast';
import { workspaceApi } from '../utils/api';
import useAuthStore from '../store/authStore';
import './CreateWorkspaceModal.css';

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

function CreateWorkspaceModal({ onClose, onSuccess }) {
  const { addWorkspace } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Workspace name is required';
    } else if (formData.name.trim().length > MAX_NAME_LENGTH) {
      newErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`;
    }

    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await workspaceApi.create({
        name: formData.name.trim(),
        description: formData.description.trim(),
      });

      const { workspace } = response.data;

      // Add workspace to local state
      addWorkspace(workspace);

      toast.success('Workspace created successfully');
      onClose();

      // Callback to handle post-creation actions (like selecting the new workspace)
      if (onSuccess) {
        onSuccess(workspace);
      }
    } catch (error) {
      console.error('Create workspace error:', error);

      if (error.errors) {
        // Handle validation errors from server
        const serverErrors = {};
        error.errors.forEach((err) => {
          serverErrors[err.path] = err.msg;
        });
        setErrors(serverErrors);
      } else {
        toast.error(error.message || 'Failed to create workspace');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-workspace-title"
    >
      <div className="modal-container create-workspace-modal">
        <div className="modal-header">
          <h2 id="create-workspace-title" className="modal-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="modal-icon">
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
              <path d="M12 11V3" />
              <path d="M9 8l3-3 3 3" />
              <path d="M3 21h18" />
              <rect x="8" y="14" width="8" height="7" rx="1" />
            </svg>
            Create New Workspace
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
            type="button"
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

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="workspace-name" className="form-label">
              Workspace Name
              <span className="required-indicator">*</span>
            </label>
            <input
              type="text"
              id="workspace-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Security Team, Project Alpha, Personal Projects"
              maxLength={MAX_NAME_LENGTH}
              required
              autoFocus
              className={`form-input ${errors.name ? 'has-error' : ''}`}
              aria-describedby={errors.name ? 'name-error' : 'name-hint'}
              aria-invalid={errors.name ? 'true' : 'false'}
            />
            <div className="input-footer">
              {errors.name ? (
                <span id="name-error" className="error-message" role="alert">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors.name}
                </span>
              ) : (
                <span id="name-hint" className="input-hint">
                  Choose a name that identifies this workspace
                </span>
              )}
              <span className="character-count">
                {formData.name.length}/{MAX_NAME_LENGTH}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="workspace-description" className="form-label">
              Description
              <span className="optional-indicator">(optional)</span>
            </label>
            <textarea
              id="workspace-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of this workspace's purpose..."
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={3}
              className={`form-input form-textarea ${errors.description ? 'has-error' : ''}`}
              aria-describedby={errors.description ? 'description-error' : 'description-hint'}
              aria-invalid={errors.description ? 'true' : 'false'}
            />
            <div className="input-footer">
              {errors.description ? (
                <span id="description-error" className="error-message" role="alert">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors.description}
                </span>
              ) : (
                <span id="description-hint" className="input-hint">
                  Help team members understand this workspace's focus
                </span>
              )}
              <span className="character-count">
                {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
          </div>

          <div className="workspace-preview">
            <div className="preview-label">Preview</div>
            <div className="preview-card">
              <div className="preview-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                  <path d="M3 21h18" />
                  <rect x="8" y="10" width="8" height="11" rx="1" />
                </svg>
              </div>
              <div className="preview-content">
                <span className="preview-name">
                  {formData.name.trim() || 'Workspace Name'}
                </span>
                {formData.description.trim() && (
                  <span className="preview-description">
                    {formData.description.trim()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-create"
              disabled={isLoading || !formData.name.trim()}
            >
              {isLoading ? (
                <>
                  <span className="spinner spinner-sm"></span>
                  Creating...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                  </svg>
                  Create Workspace
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateWorkspaceModal;
