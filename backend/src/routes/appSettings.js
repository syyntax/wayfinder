import express from 'express';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';
import {
    getSettings,
    updateSettings,
    getPublicSettings
} from '../controllers/appSettingsController.js';

const router = express.Router();

/**
 * GET /api/admin/settings
 * Get app settings (Super Admin only)
 * Returns registration_requires_approval and other settings
 */
router.get('/settings', authenticateToken, requireSuperAdmin, getSettings);

/**
 * PATCH /api/admin/settings
 * Update app settings (Super Admin only)
 * Body:
 *   - registration_requires_approval: boolean
 */
router.patch('/settings', authenticateToken, requireSuperAdmin, updateSettings);

/**
 * GET /api/settings/public
 * Get public settings (no auth required)
 * Used by frontend to show appropriate messages during registration
 */
router.get('/public', getPublicSettings);

export default router;
