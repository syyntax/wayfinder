import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useBoardStore from '../store/boardStore';
import './Modal.css';

const THEMES = [
  { id: 'cyber-purple', name: 'Cyber Purple', color: '#8b3daf' },
  { id: 'neon-cyan', name: 'Neon Cyan', color: '#06b6d4' },
  { id: 'magenta-pink', name: 'Magenta', color: '#ec4899' },
  { id: 'ember-orange', name: 'Ember', color: '#f97316' },
  { id: 'toxic-green', name: 'Toxic', color: '#10b981' },
  { id: 'blood-red', name: 'Blood', color: '#dc2626' },
];

function CreateBoardModal({ workspaceId, onClose }) {
  const navigate = useNavigate();
  const { createBoard } = useBoardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    backgroundTheme: 'cyber-purple',
    visibility: 'private',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Board name is required');
      return;
    }

    setIsLoading(true);

    try {
      const board = await createBoard({
        ...formData,
        workspaceId,
      });
      toast.success('Board created');
      onClose();
      navigate(`/board/${board.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create board');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            <svg viewBox="0 0 20 20" fill="currentColor" className="modal-icon">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Create New Board
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Board Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Project Alpha, Sprint Planning"
              required
              autoFocus
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">Description (Optional)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of this board's purpose"
              rows={3}
              className="form-input form-textarea"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Theme</label>
            <div className="theme-grid">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={`theme-option ${formData.backgroundTheme === theme.id ? 'selected' : ''}`}
                  style={{ '--theme-color': theme.color }}
                  onClick={() => setFormData({ ...formData, backgroundTheme: theme.id })}
                  title={theme.name}
                >
                  <span className="theme-color"></span>
                  {formData.backgroundTheme === theme.id && (
                    <svg className="theme-check" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="visibility" className="form-label">Visibility</label>
            <select
              id="visibility"
              name="visibility"
              value={formData.visibility}
              onChange={handleChange}
              className="form-input"
            >
              <option value="private">Private - Only you</option>
              <option value="workspace">Workspace - Team members</option>
              <option value="public">Public - Anyone with link</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Creating...
                </>
              ) : (
                'Create Board'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateBoardModal;
