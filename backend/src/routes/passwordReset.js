import { Router } from 'express';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators.js';
import {
    requestPasswordReset,
    verifyResetToken,
    resetPassword
} from '../controllers/passwordResetController.js';

const router = Router();

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 * Public route - no authentication required
 */
router.post('/forgot-password', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    handleValidationErrors
], requestPasswordReset);

/**
 * GET /api/auth/reset-password/:token
 * Verify a password reset token is valid
 * Public route - no authentication required
 */
router.get('/reset-password/:token', [
    param('token')
        .isLength({ min: 64, max: 64 })
        .isHexadecimal()
        .withMessage('Invalid token format'),
    handleValidationErrors
], verifyResetToken);

/**
 * POST /api/auth/reset-password/:token
 * Reset password using a valid token
 * Public route - no authentication required
 */
router.post('/reset-password/:token', [
    param('token')
        .isLength({ min: 64, max: 64 })
        .isHexadecimal()
        .withMessage('Invalid token format'),
    body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
    handleValidationErrors
], resetPassword);

export default router;
