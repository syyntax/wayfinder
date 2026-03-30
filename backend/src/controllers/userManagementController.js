import bcrypt from 'bcryptjs';
import { getDatabase } from '../db/database.js';
import { generateId, sanitizeUser, apiResponse } from '../utils/helpers.js';
import { sendApprovalEmail, sendRejectionEmail } from '../services/mailService.js';

/**
 * Validate password strength
 * Requirements: min 8 chars, uppercase, lowercase, number
 */
function validatePasswordStrength(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate username format
 * Requirements: 3-30 chars, alphanumeric + underscore/dash
 */
function validateUsername(username) {
    if (!username || username.length < 3 || username.length > 30) {
        return { valid: false, error: 'Username must be between 3 and 30 characters' };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return { valid: false, error: 'Username can only contain letters, numbers, underscores, and dashes' };
    }
    return { valid: true };
}

/**
 * Validate email format
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return { valid: false, error: 'Invalid email format' };
    }
    return { valid: true };
}

/**
 * Validate role
 */
function validateRole(role) {
    const validRoles = ['super_admin', 'admin', 'member'];
    if (!role || !validRoles.includes(role)) {
        return { valid: false, error: 'Invalid role specified. Must be one of: super_admin, admin, member' };
    }
    return { valid: true };
}

/**
 * Get all users (Super Admin only)
 * Supports pagination, search, and approval status filtering
 */
export async function getAllUsers(req, res) {
    try {
        const db = getDatabase();
        const { page = 1, limit = 20, search = '', approval_status = 'all' } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let whereConditions = [];
        const params = [];

        // Search filter
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            whereConditions.push('(username LIKE ? OR email LIKE ? OR display_name LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Approval status filter
        if (approval_status === 'approved') {
            whereConditions.push('is_approved = 1');
        } else if (approval_status === 'pending') {
            whereConditions.push('is_approved = 0');
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
        const countResult = db.prepare(countQuery).get(...params);
        const total = countResult.total;

        // Get users with pagination
        const usersQuery = `
            SELECT
                id, username, email, display_name, avatar_url, role,
                is_approved, approved_by, approved_at,
                created_at, updated_at, last_login
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const users = db.prepare(usersQuery).all(...params, limitNum, offset);

        // Get workspace membership counts for each user
        const usersWithStats = users.map(user => {
            const workspaceCount = db.prepare(`
                SELECT COUNT(*) as count FROM workspace_members WHERE user_id = ?
            `).get(user.id);

            // Get approver info if available
            let approverInfo = null;
            if (user.approved_by) {
                const approver = db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(user.approved_by);
                approverInfo = approver ? { username: approver.username, display_name: approver.display_name } : null;
            }

            return {
                ...user,
                is_approved: Boolean(user.is_approved),
                workspace_count: workspaceCount.count,
                approver: approverInfo
            };
        });

        res.json(apiResponse(true, {
            users: usersWithStats,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        }));

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to fetch users'));
    }
}

/**
 * Get pending users (Super Admin only)
 * Returns users awaiting approval
 */
export async function getPendingUsers(req, res) {
    try {
        const db = getDatabase();

        const users = db.prepare(`
            SELECT
                id, username, email, display_name, avatar_url, role,
                created_at, updated_at
            FROM users
            WHERE is_approved = 0
            ORDER BY created_at DESC
        `).all();

        res.json(apiResponse(true, {
            users,
            count: users.length
        }));

    } catch (error) {
        console.error('Get pending users error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to fetch pending users'));
    }
}

/**
 * Approve a pending user (Super Admin only)
 */
export async function approveUser(req, res) {
    try {
        const { userId } = req.params;
        const db = getDatabase();

        // Get the user to be approved
        const userToApprove = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!userToApprove) {
            return res.status(404).json(apiResponse(false, null, 'User not found'));
        }

        // Check if already approved
        if (userToApprove.is_approved === 1) {
            return res.status(400).json(apiResponse(false, null, 'User is already approved'));
        }

        const now = new Date().toISOString();

        // Begin transaction
        const approveTransaction = db.transaction(() => {
            // Update user as approved
            db.prepare(`
                UPDATE users
                SET is_approved = 1, approved_by = ?, approved_at = ?, updated_at = ?
                WHERE id = ?
            `).run(req.user.id, now, now, userId);

            // Create default personal workspace for the user
            const workspaceId = generateId();
            const displayNameForWorkspace = userToApprove.display_name || userToApprove.username;

            db.prepare(`
                INSERT INTO workspaces (id, name, description, owner_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(workspaceId, `${displayNameForWorkspace}'s Workspace`, 'Personal workspace', userId, now, now);

            // Add user to their workspace
            db.prepare(`
                INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
                VALUES (?, ?, 'owner', ?)
            `).run(workspaceId, userId, now);

            return workspaceId;
        });

        const workspaceId = approveTransaction();

        // Log the action
        console.log(`[User Management] User approved: ${userToApprove.username} (${userToApprove.email}) by Super Admin ${req.user.username}`);

        // Send approval email (non-blocking)
        try {
            await sendApprovalEmail(userToApprove.email, userToApprove.display_name || userToApprove.username);
        } catch (emailError) {
            console.warn('Failed to send approval email:', emailError.message);
            // Don't fail the request if email fails
        }

        // Get updated user
        const updatedUser = db.prepare(`
            SELECT id, username, email, display_name, avatar_url, role, is_approved, approved_by, approved_at, created_at
            FROM users WHERE id = ?
        `).get(userId);

        res.json(apiResponse(true, {
            user: {
                ...updatedUser,
                is_approved: Boolean(updatedUser.is_approved),
                workspace_count: 1
            },
            workspaceId
        }, `User "${userToApprove.username}" has been approved`));

    } catch (error) {
        console.error('Approve user error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to approve user'));
    }
}

/**
 * Reject a pending user (Super Admin only)
 * Deletes the user record
 */
export async function rejectUser(req, res) {
    try {
        const { userId } = req.params;
        const db = getDatabase();

        // Get the user to be rejected
        const userToReject = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!userToReject) {
            return res.status(404).json(apiResponse(false, null, 'User not found'));
        }

        // Check if already approved (cannot reject approved users)
        if (userToReject.is_approved === 1) {
            return res.status(400).json(apiResponse(false, null, 'Cannot reject an already approved user. Use delete instead.'));
        }

        // Delete the pending user
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        // Log the action
        console.log(`[User Management] User registration rejected: ${userToReject.username} (${userToReject.email}) by Super Admin ${req.user.username}`);

        // Send rejection email (non-blocking)
        try {
            await sendRejectionEmail(userToReject.email, userToReject.display_name || userToReject.username);
        } catch (emailError) {
            console.warn('Failed to send rejection email:', emailError.message);
            // Don't fail the request if email fails
        }

        res.json(apiResponse(true, {
            deletedUser: {
                id: userToReject.id,
                username: userToReject.username,
                email: userToReject.email
            }
        }, `Registration for "${userToReject.username}" has been rejected`));

    } catch (error) {
        console.error('Reject user error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to reject user'));
    }
}

/**
 * Create a new user (Super Admin only)
 */
export async function createUser(req, res) {
    try {
        const { username, email, password, display_name, role } = req.body;
        const db = getDatabase();

        // Validate required fields
        if (!username || !email || !password || !role) {
            return res.status(400).json(apiResponse(false, null, 'Username, email, password, and role are required'));
        }

        // Validate username
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json(apiResponse(false, null, usernameValidation.error));
        }

        // Validate email
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            return res.status(400).json(apiResponse(false, null, emailValidation.error));
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            return res.status(400).json(apiResponse(false, null, passwordValidation.errors.join('. ')));
        }

        // Validate role
        const roleValidation = validateRole(role);
        if (!roleValidation.valid) {
            return res.status(400).json(apiResponse(false, null, roleValidation.error));
        }

        // Validate display name if provided
        if (display_name && display_name.length > 100) {
            return res.status(400).json(apiResponse(false, null, 'Display name must not exceed 100 characters'));
        }

        // Check if username already exists
        const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUsername) {
            return res.status(409).json(apiResponse(false, null, 'Username already exists'));
        }

        // Check if email already exists
        const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingEmail) {
            return res.status(409).json(apiResponse(false, null, 'Email already exists'));
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user (users created by admin are auto-approved)
        const userId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO users (id, email, username, password_hash, display_name, role, is_approved, approved_by, approved_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        `).run(userId, email, username, passwordHash, display_name || username, role, req.user.id, now, now, now);

        // Create default personal workspace for the user
        const workspaceId = generateId();
        const displayNameForWorkspace = display_name || username;
        db.prepare(`
            INSERT INTO workspaces (id, name, description, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(workspaceId, `${displayNameForWorkspace}'s Workspace`, 'Personal workspace', userId, now, now);

        // Add user to their workspace
        db.prepare(`
            INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
            VALUES (?, ?, 'owner', ?)
        `).run(workspaceId, userId, now);

        // Get the created user (sanitized)
        const user = db.prepare(`
            SELECT id, username, email, display_name, avatar_url, role, is_approved, created_at, updated_at
            FROM users WHERE id = ?
        `).get(userId);

        // Log the action
        console.log(`[User Management] User created: ${username} (${email}) by Super Admin ${req.user.username}`);

        res.status(201).json(apiResponse(true, {
            user: {
                ...user,
                is_approved: Boolean(user.is_approved),
                workspace_count: 1
            }
        }, `User "${username}" created successfully`));

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to create user'));
    }
}

/**
 * Delete a user (Super Admin only)
 * Cannot delete self or other super admins
 */
export async function deleteUser(req, res) {
    try {
        const { userId } = req.params;
        const db = getDatabase();

        // Get the user to be deleted
        const userToDelete = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!userToDelete) {
            return res.status(404).json(apiResponse(false, null, 'User not found'));
        }

        // Cannot delete self
        if (userToDelete.id === req.user.id) {
            return res.status(403).json(apiResponse(false, null, 'Cannot delete your own account'));
        }

        // Cannot delete other super admins
        if (userToDelete.role === 'super_admin') {
            return res.status(403).json(apiResponse(false, null, 'Cannot delete other Super Admin accounts'));
        }

        // Get workspaces owned by this user for potential transfer/deletion
        const ownedWorkspaces = db.prepare(`
            SELECT id, name FROM workspaces WHERE owner_id = ?
        `).all(userId);

        // Begin transaction for safe deletion
        const deleteTransaction = db.transaction(() => {
            // Delete user's workspace memberships
            db.prepare('DELETE FROM workspace_members WHERE user_id = ?').run(userId);

            // Handle workspaces owned by this user
            // Option: Delete workspaces they own (along with CASCADE deletes for boards, etc.)
            // This is the destructive approach - alternatively, could transfer ownership
            for (const workspace of ownedWorkspaces) {
                // Get boards in this workspace
                const boards = db.prepare('SELECT id FROM boards WHERE workspace_id = ?').all(workspace.id);

                for (const board of boards) {
                    // Delete lists and cards in this board
                    const lists = db.prepare('SELECT id FROM lists WHERE board_id = ?').all(board.id);

                    for (const list of lists) {
                        const cards = db.prepare('SELECT id FROM cards WHERE list_id = ?').all(list.id);

                        for (const card of cards) {
                            // Delete card-related data
                            db.prepare('DELETE FROM card_labels WHERE card_id = ?').run(card.id);
                            db.prepare('DELETE FROM card_assignees WHERE card_id = ?').run(card.id);
                            db.prepare('DELETE FROM comments WHERE card_id = ?').run(card.id);
                            db.prepare('DELETE FROM checklist_items WHERE checklist_id IN (SELECT id FROM checklists WHERE card_id = ?)').run(card.id);
                            db.prepare('DELETE FROM checklists WHERE card_id = ?').run(card.id);
                            db.prepare('DELETE FROM attachments WHERE card_id = ?').run(card.id);
                        }

                        // Delete cards in list
                        db.prepare('DELETE FROM cards WHERE list_id = ?').run(list.id);
                    }

                    // Delete lists in board
                    db.prepare('DELETE FROM lists WHERE board_id = ?').run(board.id);

                    // Delete board labels
                    db.prepare('DELETE FROM labels WHERE board_id = ?').run(board.id);
                }

                // Delete boards in workspace
                db.prepare('DELETE FROM boards WHERE workspace_id = ?').run(workspace.id);

                // Delete workspace members
                db.prepare('DELETE FROM workspace_members WHERE workspace_id = ?').run(workspace.id);

                // Delete workspace
                db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspace.id);
            }

            // Remove user from card assignees on other boards
            db.prepare('DELETE FROM card_assignees WHERE user_id = ?').run(userId);

            // Delete user's comments (or optionally keep with "deleted user" reference)
            db.prepare('DELETE FROM comments WHERE user_id = ?').run(userId);

            // Finally, delete the user
            db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        });

        // Execute the transaction
        deleteTransaction();

        // Log the action
        console.log(`[User Management] User deleted: ${userToDelete.username} (${userToDelete.email}) by Super Admin ${req.user.username}`);

        res.json(apiResponse(true, {
            deletedUser: {
                id: userToDelete.id,
                username: userToDelete.username,
                email: userToDelete.email
            },
            deletedWorkspacesCount: ownedWorkspaces.length
        }, `User "${userToDelete.username}" and their data have been deleted`));

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete user'));
    }
}

/**
 * Get a single user by ID (Super Admin only)
 */
export async function getUserById(req, res) {
    try {
        const { userId } = req.params;
        const db = getDatabase();

        const user = db.prepare(`
            SELECT id, username, email, display_name, avatar_url, role, is_approved, approved_by, approved_at, created_at, updated_at, last_login
            FROM users WHERE id = ?
        `).get(userId);

        if (!user) {
            return res.status(404).json(apiResponse(false, null, 'User not found'));
        }

        // Get workspace count
        const workspaceCount = db.prepare(`
            SELECT COUNT(*) as count FROM workspace_members WHERE user_id = ?
        `).get(userId);

        // Get workspaces owned by user
        const ownedWorkspaces = db.prepare(`
            SELECT id, name FROM workspaces WHERE owner_id = ?
        `).all(userId);

        // Get approver info if available
        let approverInfo = null;
        if (user.approved_by) {
            const approver = db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(user.approved_by);
            approverInfo = approver ? { username: approver.username, display_name: approver.display_name } : null;
        }

        res.json(apiResponse(true, {
            user: {
                ...user,
                is_approved: Boolean(user.is_approved),
                workspace_count: workspaceCount.count,
                owned_workspaces: ownedWorkspaces,
                approver: approverInfo
            }
        }));

    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to fetch user'));
    }
}

export default {
    getAllUsers,
    getPendingUsers,
    approveUser,
    rejectUser,
    createUser,
    deleteUser,
    getUserById
};
