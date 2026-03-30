import { Router } from 'express';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';
import {
    getSettings,
    updateSettings,
    testEmail,
    verifySettings
} from '../controllers/mailController.js';

const router = Router();

// All mail routes require Super Admin authentication
router.use(authenticateToken);
router.use(requireSuperAdmin);

/**
 * GET /api/mail/settings
 * Get current mail server settings (password masked)
 */
router.get('/settings', getSettings);

/**
 * PUT /api/mail/settings
 * Update mail server settings
 */
router.put('/settings', updateSettings);

/**
 * POST /api/mail/test
 * Send a test email to verify configuration
 */
router.post('/test', testEmail);

/**
 * POST /api/mail/verify
 * Verify SMTP connection without sending email
 */
router.post('/verify', verifySettings);

export default router;
