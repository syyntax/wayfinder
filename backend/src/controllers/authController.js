import bcrypt from 'bcryptjs';
import { getDatabase } from '../db/database.js';
import { generateToken } from '../middleware/auth.js';
import { generateId, sanitizeUser, apiResponse } from '../utils/helpers.js';

/**
 * Check if registration requires approval
 */
function checkRegistrationRequiresApproval() {
    const db = getDatabase();
    const settings = db.prepare('SELECT registration_requires_approval FROM app_settings WHERE id = 1').get();
    return settings ? Boolean(settings.registration_requires_approval) : false;
}

/**
 * Register a new user
 * First user becomes Super Admin (always auto-approved)
 * Subsequent users may require approval based on settings
 */
export async function register(req, res) {
    try {
        const { email, username, password, displayName } = req.body;
        const db = getDatabase();

        // Check if email already exists
        const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingEmail) {
            return res.status(409).json(apiResponse(false, null, 'Email already registered'));
        }

        // Check if username already exists
        const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUsername) {
            return res.status(409).json(apiResponse(false, null, 'Username already taken'));
        }

        // Check if this is the first user (becomes Super Admin, always auto-approved)
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
        const isFirstUser = userCount.count === 0;
        const role = isFirstUser ? 'super_admin' : 'member';

        // Check if registration requires approval
        const requiresApproval = checkRegistrationRequiresApproval();

        // First user (Super Admin) is always auto-approved
        // Other users depend on the registration_requires_approval setting
        const isApproved = isFirstUser ? 1 : (requiresApproval ? 0 : 1);

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const userId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO users (id, email, username, password_hash, display_name, role, is_approved, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, email, username, passwordHash, displayName || username, role, isApproved, now, now);

        // Get the created user
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        // If user is approved, create workspace and return token
        if (isApproved) {
            // Create default personal workspace for the user
            const workspaceId = generateId();
            db.prepare(`
                INSERT INTO workspaces (id, name, description, owner_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(workspaceId, `${displayName || username}'s Workspace`, 'Personal workspace', userId, now, now);

            // Add user to their workspace
            db.prepare(`
                INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
                VALUES (?, ?, 'owner', ?)
            `).run(workspaceId, userId, now);

            const token = generateToken(userId);

            res.status(201).json(apiResponse(true, {
                user: sanitizeUser(user),
                token,
                workspace: { id: workspaceId, name: `${displayName || username}'s Workspace` },
                pending_approval: false
            }, role === 'super_admin' ? 'Welcome! You are the Super Admin.' : 'Registration successful'));
        } else {
            // User requires approval - don't create workspace or return token
            res.status(201).json(apiResponse(true, {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    display_name: user.display_name
                },
                pending_approval: true
            }, 'Registration successful! Your account is pending administrator approval. You will receive an email once your account is approved.'));
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json(apiResponse(false, null, 'Registration failed'));
    }
}

/**
 * Login user
 * Checks if user is approved before allowing login
 */
export async function login(req, res) {
    try {
        const { email, password } = req.body;
        const db = getDatabase();

        // Find user by email
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json(apiResponse(false, null, 'Invalid credentials'));
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json(apiResponse(false, null, 'Invalid credentials'));
        }

        // Check if user is approved
        if (user.is_approved === 0) {
            return res.status(403).json(apiResponse(false, {
                pending_approval: true
            }, 'Your account is pending approval by an administrator. You will be notified by email once approved.'));
        }

        // Update last login
        db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);

        // Generate token
        const token = generateToken(user.id);

        // Get user's workspaces
        const workspaces = db.prepare(`
            SELECT w.* FROM workspaces w
            JOIN workspace_members wm ON w.id = wm.workspace_id
            WHERE wm.user_id = ?
        `).all(user.id);

        res.json(apiResponse(true, {
            user: sanitizeUser(user),
            token,
            workspaces
        }, 'Login successful'));

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json(apiResponse(false, null, 'Login failed'));
    }
}

/**
 * Get current user profile
 */
export function getProfile(req, res) {
    try {
        const db = getDatabase();

        // Get user's workspaces
        const workspaces = db.prepare(`
            SELECT w.*, wm.role as member_role FROM workspaces w
            JOIN workspace_members wm ON w.id = wm.workspace_id
            WHERE wm.user_id = ?
        `).all(req.user.id);

        res.json(apiResponse(true, {
            user: req.user,
            workspaces
        }));

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get profile'));
    }
}

/**
 * Update user profile
 */
export async function updateProfile(req, res) {
    try {
        const { displayName, avatarUrl } = req.body;
        const db = getDatabase();

        const updates = [];
        const values = [];

        if (displayName !== undefined) {
            updates.push('display_name = ?');
            values.push(displayName);
        }

        if (avatarUrl !== undefined) {
            updates.push('avatar_url = ?');
            values.push(avatarUrl);
        }

        if (updates.length === 0) {
            return res.status(400).json(apiResponse(false, null, 'No fields to update'));
        }

        updates.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(req.user.id);

        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        res.json(apiResponse(true, { user: sanitizeUser(user) }, 'Profile updated'));

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update profile'));
    }
}

/**
 * Change password
 */
export async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        const db = getDatabase();

        // Get user with password
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json(apiResponse(false, null, 'Current password is incorrect'));
        }

        // Hash new password
        const saltRounds = 12;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
            .run(newPasswordHash, new Date().toISOString(), req.user.id);

        res.json(apiResponse(true, null, 'Password changed successfully'));

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to change password'));
    }
}

export default {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword
};
