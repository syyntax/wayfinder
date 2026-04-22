import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { workspaceApi } from '../utils/api';
import useAuthStore from '../store/authStore';
import './WorkspacePage.css';

function WorkspacePage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [boards, setBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    loadWorkspace();
  }, [workspaceId]);

  const loadWorkspace = async () => {
    setIsLoading(true);
    try {
      const response = await workspaceApi.getOne(workspaceId);
      setWorkspace(response.data.workspace);
      setMembers(response.data.members || []);
      setBoards(response.data.boards || []);
      setEditName(response.data.workspace.name);
      setEditDescription(response.data.workspace.description || '');
    } catch (error) {
      toast.error('Failed to load workspace');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateWorkspace = async () => {
    if (!editName.trim()) {
      toast.error('Workspace name is required');
      return;
    }

    try {
      await workspaceApi.update(workspaceId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setWorkspace({ ...workspace, name: editName.trim(), description: editDescription.trim() });
      setIsEditing(false);
      toast.success('Workspace updated');
    } catch (error) {
      toast.error('Failed to update workspace');
    }
  };

  const handleInvite = async () => {
    if (!inviteUsername.trim()) {
      toast.error('Username is required');
      return;
    }

    try {
      const response = await workspaceApi.invite(workspaceId, {
        username: inviteUsername.trim(),
        role: inviteRole,
      });
      setMembers([...members, response.data.member]);
      setInviteUsername('');
      setShowInvite(false);
      toast.success('Member invited');
    } catch (error) {
      toast.error(error.message || 'Failed to invite member');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the workspace?')) return;

    try {
      await workspaceApi.removeMember(workspaceId, memberId);
      setMembers(members.filter((m) => m.id !== memberId));
      toast.success('Member removed');
    } catch (error) {
      toast.error(error.message || 'Failed to remove member');
    }
  };

  const isOwnerOrAdmin = workspace?.member_role === 'owner' || workspace?.member_role === 'admin';

  if (isLoading) {
    return (
      <div className="workspace-loading">
        <div className="spinner"></div>
        <p>Loading workspace...</p>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="workspace-page">
      <div className="workspace-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {isEditing ? (
          <div className="workspace-edit-form">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Workspace name"
              autoFocus
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
            />
            <div className="edit-actions">
              <button className="btn btn-primary btn-sm" onClick={handleUpdateWorkspace}>
                Save
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(workspace.name);
                  setEditDescription(workspace.description || '');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="workspace-info">
            <h1 className="workspace-name">{workspace.name}</h1>
            {workspace.description && (
              <p className="workspace-description">{workspace.description}</p>
            )}
            {isOwnerOrAdmin && (
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      <div className="workspace-content">
        {/* Members Section */}
        <section className="workspace-section">
          <div className="section-header">
            <h2 className="section-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              Members ({members.length})
            </h2>
            {isOwnerOrAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                </svg>
                Invite
              </button>
            )}
          </div>

          {showInvite && (
            <div className="invite-form panel">
              <h3>Invite Member</h3>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  placeholder="username"
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="invite-actions">
                <button className="btn btn-primary" onClick={handleInvite}>
                  Send Invite
                </button>
                <button className="btn btn-ghost" onClick={() => setShowInvite(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="members-list">
            {members.map((member) => (
              <div key={member.id} className="member-card">
                <div className="member-avatar">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.display_name} />
                  ) : (
                    <span>{(member.display_name || member.username)[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="member-info">
                  <span className="member-name">{member.display_name || member.username}</span>
                  <span className="member-email">{member.email}</span>
                </div>
                <span className={`member-role badge badge-${member.role === 'owner' ? 'purple' : member.role === 'admin' ? 'cyan' : 'green'}`}>
                  {member.role}
                </span>
                {isOwnerOrAdmin && member.id !== user.id && member.role !== 'owner' && (
                  <button
                    className="member-remove"
                    onClick={() => handleRemoveMember(member.id)}
                    title="Remove member"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Boards Section */}
        <section className="workspace-section">
          <div className="section-header">
            <h2 className="section-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              Boards ({boards.length})
            </h2>
          </div>

          {boards.length === 0 ? (
            <div className="empty-state-small">
              <p>No boards in this workspace yet.</p>
            </div>
          ) : (
            <div className="boards-list">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className="board-item"
                  onClick={() => navigate(`/board/${board.id}`)}
                >
                  <div className="board-item-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                  </div>
                  <div className="board-item-info">
                    <span className="board-item-name">{board.name}</span>
                    {board.description && (
                      <span className="board-item-description">{board.description}</span>
                    )}
                  </div>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="board-item-arrow">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default WorkspacePage;
