import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useBoardStore from '../store/boardStore';
import CreateBoardModal from '../components/CreateBoardModal';
import CreateWorkspaceModal from '../components/CreateWorkspaceModal';
import './DashboardPage.css';

const WORKSPACE_STORAGE_KEY = 'wayfinder_selected_workspace';

function DashboardPage() {
  const navigate = useNavigate();
  const { user, workspaces } = useAuthStore();
  const { boards, fetchBoards, isLoading } = useBoardStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateWorkspaceModal, setShowCreateWorkspaceModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  useEffect(() => {
    fetchBoards().catch((error) => {
      toast.error('Failed to load boards');
    });
  }, [fetchBoards]);

  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace) {
      // Check localStorage for a previously selected workspace
      const storedWorkspaceId = localStorage.getItem(WORKSPACE_STORAGE_KEY);

      if (storedWorkspaceId) {
        // Validate that the stored workspace ID still exists and user has access
        const isValidWorkspace = workspaces.some((ws) => ws.id === storedWorkspaceId);

        if (isValidWorkspace) {
          setSelectedWorkspace(storedWorkspaceId);
          return;
        }
        // If stored workspace is invalid, remove it from localStorage
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      }

      // Fall back to newest workspace (first in the list)
      setSelectedWorkspace(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspace]);

  // Handler for workspace selection changes
  const handleWorkspaceChange = (workspaceId) => {
    setSelectedWorkspace(workspaceId);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  };

  const handleWorkspaceCreated = (workspace) => {
    // Automatically select the newly created workspace and persist to localStorage
    setSelectedWorkspace(workspace.id);
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.id);
  };

  const filteredBoards = selectedWorkspace
    ? boards.filter((b) => b.workspace_id === selectedWorkspace)
    : boards;

  const starredBoards = filteredBoards.filter((b) => b.is_starred);
  const regularBoards = filteredBoards.filter((b) => !b.is_starred);

  const getThemeGradient = (theme) => {
    const themes = {
      'cyber-purple': 'linear-gradient(135deg, rgba(139, 61, 175, 0.3), rgba(107, 45, 143, 0.2))',
      'neon-cyan': 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(8, 145, 178, 0.2))',
      'magenta-pink': 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(190, 24, 93, 0.2))',
      'ember-orange': 'linear-gradient(135deg, rgba(249, 115, 22, 0.3), rgba(194, 65, 12, 0.2))',
      'toxic-green': 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(5, 150, 105, 0.2))',
      'blood-red': 'linear-gradient(135deg, rgba(220, 38, 38, 0.3), rgba(153, 27, 27, 0.2))',
    };
    return themes[theme] || themes['cyber-purple'];
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">
            <span className="title-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            Command Center
          </h1>
          <p className="dashboard-subtitle">
            Welcome back, <span className="highlight">{user?.display_name || user?.username}</span>
          </p>
        </div>

        <div className="header-actions">
          <div className="workspace-selector">
            <select
              value={selectedWorkspace || ''}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="workspace-select"
              aria-label="Select workspace"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            <button
              className="workspace-settings-btn"
              onClick={() => selectedWorkspace && navigate(`/workspace/${selectedWorkspace}`)}
              title="Workspace Settings"
              aria-label="Workspace Settings"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              className="btn btn-create-workspace"
              onClick={() => setShowCreateWorkspaceModal(true)}
              title="Create New Workspace"
              aria-label="Create New Workspace"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
              </svg>
              <span className="btn-text">New Workspace</span>
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 18, height: 18 }}>
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            New Board
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading mission boards...</p>
        </div>
      ) : (
        <div className="boards-container">
          {starredBoards.length > 0 && (
            <section className="boards-section">
              <h2 className="section-title">
                <svg viewBox="0 0 20 20" fill="currentColor" className="section-icon starred">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Starred Boards
              </h2>
              <div className="boards-grid">
                {starredBoards.map((board) => (
                  <div
                    key={board.id}
                    className={`board-card ${board.cover_image ? 'has-cover' : ''}`}
                    style={{ '--board-gradient': getThemeGradient(board.background_theme) }}
                    onClick={() => navigate(`/board/${board.id}`)}
                  >
                    {board.cover_image ? (
                      <div className="board-cover-image">
                        <img
                          src={board.cover_image}
                          alt=""
                          onError={(e) => {
                            e.target.parentElement.classList.add('cover-error');
                          }}
                        />
                        <div className="board-cover-overlay" />
                      </div>
                    ) : (
                      <div className="board-background"></div>
                    )}
                    <div className="board-content">
                      <h3 className="board-name">{board.name}</h3>
                      {board.description && (
                        <p className="board-description">{board.description}</p>
                      )}
                      <div className="board-meta">
                        <span className="meta-item">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                          </svg>
                          {board.list_count || 0} lists
                        </span>
                        <span className="meta-item">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1.581.814L10 14.101l-4.419 2.713A1 1 0 014 16V4z" />
                          </svg>
                          {board.card_count || 0} cards
                        </span>
                      </div>
                    </div>
                    <div className="board-glow"></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="boards-section">
            <h2 className="section-title">
              <svg viewBox="0 0 20 20" fill="currentColor" className="section-icon">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              All Boards
            </h2>

            {regularBoards.length === 0 && starredBoards.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                  </svg>
                </div>
                <h3>No boards yet</h3>
                <p>Create your first board to start organizing your missions</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Board
                </button>
              </div>
            ) : (
              <div className="boards-grid">
                {regularBoards.map((board) => (
                  <div
                    key={board.id}
                    className={`board-card ${board.cover_image ? 'has-cover' : ''}`}
                    style={{ '--board-gradient': getThemeGradient(board.background_theme) }}
                    onClick={() => navigate(`/board/${board.id}`)}
                  >
                    {board.cover_image ? (
                      <div className="board-cover-image">
                        <img
                          src={board.cover_image}
                          alt=""
                          onError={(e) => {
                            e.target.parentElement.classList.add('cover-error');
                          }}
                        />
                        <div className="board-cover-overlay" />
                      </div>
                    ) : (
                      <div className="board-background"></div>
                    )}
                    <div className="board-content">
                      <h3 className="board-name">{board.name}</h3>
                      {board.description && (
                        <p className="board-description">{board.description}</p>
                      )}
                      <div className="board-meta">
                        <span className="meta-item">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                          </svg>
                          {board.list_count || 0} lists
                        </span>
                        <span className="meta-item">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1.581.814L10 14.101l-4.419 2.713A1 1 0 014 16V4z" />
                          </svg>
                          {board.card_count || 0} cards
                        </span>
                      </div>
                    </div>
                    <div className="board-glow"></div>
                  </div>
                ))}

                {/* Add new board card */}
                <div
                  className="board-card new-board"
                  onClick={() => setShowCreateModal(true)}
                >
                  <div className="new-board-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                    <span>Create New Board</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {showCreateModal && (
        <CreateBoardModal
          workspaceId={selectedWorkspace}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {showCreateWorkspaceModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWorkspaceModal(false)}
          onSuccess={handleWorkspaceCreated}
        />
      )}
    </div>
  );
}

export default DashboardPage;
