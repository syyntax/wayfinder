import { getDatabase } from '../db/database.js';
import { apiResponse } from '../utils/helpers.js';

/**
 * Get app settings (Super Admin only)
 * Returns registration approval settings
 */
export async function getSettings(req, res) {
    try {
        const db = getDatabase();

        const settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();

        if (!settings) {
            // Initialize settings if they don't exist
            const now = new Date().toISOString();
            db.prepare(`
                INSERT OR IGNORE INTO app_settings (id, registration_requires_approval, created_at, updated_at)
                VALUES (1, 0, ?, ?)
            `).run(now, now);

            return res.json(apiResponse(true, {
                registration_requires_approval: false,
                created_at: now,
                updated_at: now
            }));
        }

        res.json(apiResponse(true, {
            registration_requires_approval: Boolean(settings.registration_requires_approval),
            created_at: settings.created_at,
            updated_at: settings.updated_at
        }));

    } catch (error) {
        console.error('Get app settings error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to fetch app settings'));
    }
}

/**
 * Update app settings (Super Admin only)
 * Updates registration approval setting
 */
export async function updateSettings(req, res) {
    try {
        const { registration_requires_approval } = req.body;
        const db = getDatabase();

        // Validate the value is a boolean
        if (typeof registration_requires_approval !== 'boolean') {
            return res.status(400).json(apiResponse(false, null, 'registration_requires_approval must be a boolean value'));
        }

        const now = new Date().toISOString();

        // Ensure settings row exists
        const existing = db.prepare('SELECT 1 FROM app_settings WHERE id = 1').get();
        if (!existing) {
            db.prepare(`
                INSERT INTO app_settings (id, registration_requires_approval, created_at, updated_at)
                VALUES (1, ?, ?, ?)
            `).run(registration_requires_approval ? 1 : 0, now, now);
        } else {
            db.prepare(`
                UPDATE app_settings
                SET registration_requires_approval = ?, updated_at = ?
                WHERE id = 1
            `).run(registration_requires_approval ? 1 : 0, now);
        }

        // Log the action
        const action = registration_requires_approval ? 'enabled' : 'disabled';
        console.log(`[App Settings] Registration approval ${action} by Super Admin ${req.user.username}`);

        // Get updated settings
        const settings = db.prepare('SELECT * FROM app_settings WHERE id = 1').get();

        res.json(apiResponse(true, {
            registration_requires_approval: Boolean(settings.registration_requires_approval),
            created_at: settings.created_at,
            updated_at: settings.updated_at
        }, `Registration approval ${action} successfully`));

    } catch (error) {
        console.error('Update app settings error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update app settings'));
    }
}

/**
 * Get public registration settings (no auth required)
 * Used by frontend to show appropriate messages during registration
 */
export async function getPublicSettings(req, res) {
    try {
        const db = getDatabase();

        const settings = db.prepare('SELECT registration_requires_approval FROM app_settings WHERE id = 1').get();

        res.json(apiResponse(true, {
            registration_requires_approval: settings ? Boolean(settings.registration_requires_approval) : false
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
