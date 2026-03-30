import { Router } from 'express';
import { register, login, getProfile, updateProfile, changePassword } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { registerValidation, loginValidation } from '../middleware/validators.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators.js';

const router = Router();

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);
router.patch('/profile', authenticateToken, [
    body('displayName').optional().isLength({ min: 1, max: 100 }).trim(),
    body('avatarUrl').optional().isURL().withMessage('Invalid URL'),
    handleValidationErrors
], updateProfile);

router.post('/change-password', authenticateToken, [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
    handleValidationErrors
], changePassword);

export default router;
