import { getDatabase } from '../db/database.js';
import { apiResponse } from '../utils/helpers.js';
import { refreshUploadConfig, DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_MAX_UPLOAD_SIZE_MB } from '../middleware/upload.js';

function getOrInitSettings(db) {
    let settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
    if (!settings) {
        const now = new Date().toISOString();
        db.prepare(`
            INSERT OR IGNORE INTO app_settings (id, registration_requires_approval, created_at, updated_at)
            VALUES (1, 0, ?, ?)
        `).run(now, now);
        settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
    }
    return settings;
}

function formatSettings(settings) {
    let allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS;
    try {
        if (settings.allowed_attachment_extensions) {
            allowedExtensions = JSON.parse(settings.allowed_attachment_extensions);
        }
    } catch {
        // ignore malformed JSON, fall back to defaults
    }
    return {
        registration_requires_approval: Boolean(settings.registration_requires_approval),
        max_upload_size_mb: settings.max_upload_size_mb || DEFAULT_MAX_UPLOAD_SIZE_MB,
        allowed_attachment_extensions: allowedExtensions,
        created_at: settings.created_at,
        updated_at: settings.updated_at,
    };
}

/**
 * Get app settings (Super Admin only)
 */
export async function getSettings(req, res) {
    try {
        const db = getDatabase();
        const settings = getOrInitSettings(db);
        res.json(apiResponse(true, formatSettings(settings)));
    } catch (error) {
        console.error('Get app settings error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to fetch app settings'));
    }
}

/**
 * Update app settings (Super Admin only)
 */
export async function updateSettings(req, res) {
    try {
        const { registration_requires_approval, max_upload_size_mb, allowed_attachment_extensions } = req.body;
        const db = getDatabase();
        const now = new Date().toISOString();

        // Build update fields dynamically based on what was sent
        const updates = [];
        const params = [];

        if (typeof registration_requires_approval === 'boolean') {
            updates.push('registration_requires_approval = ?');
            params.push(registration_requires_approval ? 1 : 0);
        }

        if (max_upload_size_mb !== undefined) {
            const sizeMb = parseInt(max_upload_size_mb, 10);
            if (isNaN(sizeMb) || sizeMb < 1 || sizeMb > 500) {
                return res.status(400).json(apiResponse(false, null, 'max_upload_size_mb must be between 1 and 500'));
            }
            updates.push('max_upload_size_mb = ?');
            params.push(sizeMb);
        }

        if (allowed_attachment_extensions !== undefined) {
            if (!Array.isArray(allowed_attachment_extensions)) {
                return res.status(400).json(apiResponse(false, null, 'allowed_attachment_extensions must be an array'));
            }
            updates.push('allowed_attachment_extensions = ?');
            params.push(JSON.stringify(allowed_attachment_extensions));
        }

        if (updates.length === 0) {
            return res.status(400).json(apiResponse(false, null, 'No valid settings fields provided'));
        }

        updates.push('updated_at = ?');
        params.push(now);

        // Ensure row exists
        const existing = db.prepare('SELECT 1 FROM app_settings WHERE id = 1').get();
        if (!existing) {
            db.prepare(`
                INSERT INTO app_settings (id, registration_requires_approval, created_at, updated_at)
                VALUES (1, 0, ?, ?)
            `).run(now, now);
        }

        db.prepare(`UPDATE app_settings SET ${updates.join(', ')} WHERE id = 1`).run(...params);

        // Refresh the in-memory upload config cache so new limits take effect immediately
        refreshUploadConfig(db);

        console.log(`[App Settings] Updated by Super Admin ${req.user.username}:`, req.body);

        const settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();
        res.json(apiResponse(true, formatSettings(settings), 'Settings updated successfully'));

    } catch (error) {
        console.error('Update app settings error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update app settings'));
    }
}

/**
 * Get public settings (no auth required)
 * Returns registration status and upload configuration for the frontend.
 */
export async function getPublicSettings(req, res) {
    try {
        const db = getDatabase();
        const settings = db.prepare(
            'SELECT registration_requires_approval, max_upload_size_mb, allowed_attachment_extensions FROM app_settings WHERE id = 1'
        ).get();

        let allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS;
        try {
            if (settings?.allowed_attachment_extensions) {
                allowedExtensions = JSON.parse(settings.allowed_attachment_extensions);
            }
        } catch { /* fall back to defaults */ }

        res.json(apiResponse(true, {
            registration_requires_approval: settings ? Boolean(settings.registration_requires_approval) : false,
            max_upload_size_mb: settings?.max_upload_size_mb || DEFAULT_MAX_UPLOAD_SIZE_MB,
            allowed_attachment_extensions: allowedExtensions,
        }));

    } catch (error) {
        console.error('Get public settings error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to fetch settings'));
    }
}

export default {
    getSettings,
    updateSettings,
    getPublicSettings
};
