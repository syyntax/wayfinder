import { getDatabase } from '../db/database.js';
import { sanitizeUser, apiResponse } from '../utils/helpers.js';
import { UPLOAD_DIRS } from '../middleware/upload.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

/**
 * Upload user avatar
 * POST /api/users/avatar
 */
export async function uploadAvatar(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json(apiResponse(false, null, 'No file uploaded'));
        }

        const avatarPath = `/api/uploads/avatars/${req.file.filename}`;
        const userId = req.user.id;
        const db = getDatabase();

        // Delete old avatar if it exists and is a local file
        const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId);
        if (user && user.avatar_url && user.avatar_url.startsWith('/api/uploads/avatars/')) {
            const oldFilename = user.avatar_url.replace('/api/uploads/avatars/', '');
            const oldPath = join(UPLOAD_DIRS.avatars, oldFilename);
            if (existsSync(oldPath)) {
                try {
                    unlinkSync(oldPath);
                } catch (deleteError) {
                    console.error('Failed to delete old avatar:', deleteError);
                    // Continue even if deletion fails
                }
            }
        }

        // Update database
        db.prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?')
            .run(avatarPath, new Date().toISOString(), userId);

        // Get updated user
        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        res.json(apiResponse(true, {
            user: sanitizeUser(updatedUser),
            avatarUrl: avatarPath
        }, 'Avatar uploaded successfully'));

    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to upload avatar'));
    }
}

/**
 * Delete user avatar
 * DELETE /api/users/avatar
 */
export async function deleteAvatar(req, res) {
    try {
        const userId = req.user.id;
        const db = getDatabase();

        // Get current avatar
        const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId);

        if (!user) {
            return res.status(404).json(apiResponse(false, null, 'User not found'));
        }

        // Delete avatar file if it exists and is a local file
        if (user.avatar_url && user.avatar_url.startsWith('/api/uploads/avatars/')) {
            const filename = user.avatar_url.replace('/api/uploads/avatars/', '');
            const filePath = join(UPLOAD_DIRS.avatars, filename);
            if (existsSync(filePath)) {
                try {
                    unlinkSync(filePath);
                } catch (deleteError) {
                    console.error('Failed to delete avatar file:', deleteError);
                    // Continue even if deletion fails
                }
            }
        }

        // Update database to remove avatar_url
        db.prepare('UPDATE users SET avatar_url = NULL, updated_at = ? WHERE id = ?')
            .run(new Date().toISOString(), userId);

        // Get updated user
        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        res.json(apiResponse(true, {
            user: sanitizeUser(updatedUser)
        }, 'Avatar removed successfully'));

    } catch (error) {
        console.error('Avatar delete error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to remove avatar'));
    }
}

export default {
    uploadAvatar,
    deleteAvatar
};
