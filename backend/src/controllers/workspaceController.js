import { getDatabase } from '../db/database.js';
import { generateId, apiResponse, sanitizeUser } from '../utils/helpers.js';

/**
 * Get user's workspaces
 */
export function getWorkspaces(req, res) {
    try {
        const db = getDatabase();

        const workspaces = db.prepare(`
            SELECT w.*, wm.role as member_role,
                (SELECT COUNT(*) FROM boards WHERE workspace_id = w.id AND is_archived = 0) as board_count,
                (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id) as member_count
            FROM workspaces w
            JOIN workspace_members wm ON w.id = wm.workspace_id
            WHERE wm.user_id = ?
            ORDER BY w.created_at DESC
        `).all(req.user.id);

        res.json(apiResponse(true, { workspaces }));

    } catch (error) {
        console.error('Get workspaces error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get workspaces'));
    }
}

/**
 * Get a single workspace with members
 */
export function getWorkspace(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const workspace = db.prepare(`
            SELECT w.*, wm.role as member_role
            FROM workspaces w
            JOIN workspace_members wm ON w.id = wm.workspace_id
            WHERE w.id = ? AND wm.user_id = ?
        `).get(id, req.user.id);

        if (!workspace) {
            return res.status(404).json(apiResponse(false, null, 'Workspace not found or access denied'));
        }

        // Get members
        const members = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.email, wm.role, wm.joined_at
            FROM users u
            JOIN workspace_members wm ON u.id = wm.user_id
            WHERE wm.workspace_id = ?
            ORDER BY wm.role DESC, wm.joined_at ASC
        `).all(id);

        // Get boards
        const boards = db.prepare(`
            SELECT * FROM boards WHERE workspace_id = ? AND is_archived = 0 ORDER BY updated_at DESC
        `).all(id);

        res.json(apiResponse(true, { workspace, members, boards }));

    } catch (error) {
        console.error('Get workspace error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get workspace'));
    }
}

/**
 * Create a new workspace
 */
export function createWorkspace(req, res) {
    try {
        const { name, description } = req.body;
        const db = getDatabase();

        const workspaceId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO workspaces (id, name, description, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(workspaceId, name, description || '', req.user.id, now, now);

        // Add creator as owner
        db.prepare(`
            INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
            VALUES (?, ?, 'owner', ?)
        `).run(workspaceId, req.user.id, now);

        const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);

        res.status(201).json(apiResponse(true, { workspace }, 'Workspace created'));

    } catch (error) {
        console.error('Create workspace error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to create workspace'));
    }
}

/**
 * Update a workspace
 */
export function updateWorkspace(req, res) {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const db = getDatabase();

        // Check if user is owner or admin
        const membership = db.prepare(`
            SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(id, req.user.id);

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return res.status(403).json(apiResponse(false, null, 'Only owners and admins can update workspace'));
        }

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }

        if (updates.length === 0) {
            return res.status(400).json(apiResponse(false, null, 'No fields to update'));
        }

        updates.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        db.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);

        res.json(apiResponse(true, { workspace }, 'Workspace updated'));

    } catch (error) {
        console.error('Update workspace error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update workspace'));
    }
}

/**
 * Invite user to workspace
 */
export function inviteToWorkspace(req, res) {
    try {
        const { id } = req.params;
        const { email, role } = req.body;
        const db = getDatabase();

        // Check if user is owner or admin
        const membership = db.prepare(`
            SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(id, req.user.id);

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return res.status(403).json(apiResponse(false, null, 'Only owners and admins can invite members'));
        }

        // Find user by email
        const invitee = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!invitee) {
            return res.status(404).json(apiResponse(false, null, 'User not found'));
        }

        // Check if already a member
        const existingMember = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(id, invitee.id);

        if (existingMember) {
            return res.status(409).json(apiResponse(false, null, 'User is already a member'));
        }

        // Only owners can add admins
        const memberRole = role === 'admin' && membership.role !== 'owner' ? 'member' : (role || 'member');

        const now = new Date().toISOString();
        db.prepare(`
            INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?)
        `).run(id, invitee.id, memberRole, now);

        res.json(apiResponse(true, {
            member: {
                id: invitee.id,
                username: invitee.username,
                display_name: invitee.display_name,
                avatar_url: invitee.avatar_url,
                role: memberRole,
                joined_at: now
            }
        }, 'Member invited'));

    } catch (error) {
        console.error('Invite to workspace error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to invite member'));
    }
}

/**
 * Remove member from workspace
 */
export function removeMember(req, res) {
    try {
        const { id, userId } = req.params;
        const db = getDatabase();

        // Check if user is owner or admin
        const membership = db.prepare(`
            SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(id, req.user.id);

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return res.status(403).json(apiResponse(false, null, 'Only owners and admins can remove members'));
        }

        // Can't remove owner
        const targetMembership = db.prepare(`
            SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(id, userId);

        if (!targetMembership) {
            return res.status(404).json(apiResponse(false, null, 'Member not found'));
        }

        if (targetMembership.role === 'owner') {
            return res.status(403).json(apiResponse(false, null, 'Cannot remove workspace owner'));
        }

        // Admins can only remove members, not other admins
        if (membership.role === 'admin' && targetMembership.role === 'admin') {
            return res.status(403).json(apiResponse(false, null, 'Admins cannot remove other admins'));
        }

        db.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?').run(id, userId);

        res.json(apiResponse(true, null, 'Member removed'));

    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to remove member'));
    }
}

/**
 * Get all users (for invitation dropdown)
 */
export function searchUsers(req, res) {
    try {
        const { q } = req.query;
        const db = getDatabase();

        if (!q || q.length < 2) {
            return res.json(apiResponse(true, { users: [] }));
        }

        const users = db.prepare(`
            SELECT id, username, display_name, email, avatar_url FROM users
            WHERE (username LIKE ? OR email LIKE ? OR display_name LIKE ?)
            LIMIT 10
        `).all(`%${q}%`, `%${q}%`, `%${q}%`);

        res.json(apiResponse(true, { users }));

    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to search users'));
    }
}

export default {
    getWorkspaces,
    getWorkspace,
    createWorkspace,
    updateWorkspace,
    inviteToWorkspace,
    removeMember,
    searchUsers
};
