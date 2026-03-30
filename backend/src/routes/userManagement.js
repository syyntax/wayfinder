import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireSuperAdmin } from '../middleware/auth.js';
import {
    getAllUsers,
    getPendingUsers,
    approveUser,
    rejectUser,
    createUser,
    deleteUser,
    getUserById
} from '../controllers/userManagementController.js';

const router = express.Router();

// Rate limiter specifically for user creation to prevent abuse
const createUserLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit to 30 user creations per 15 minutes
    message: {
        success: false,
        message: 'Too many user creation attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiter for approval/rejection actions
const approvalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit to 50 approval/rejection actions per 15 minutes
    message: {
        success: false,
        message: 'Too many approval/rejection attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// All routes require authentication and Super Admin role
router.use(authenticateToken, requireSuperAdmin);

/**
 * GET /api/admin/users
 * Get all users with pagination, search, and filtering
 * Query params:
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 20, max: 100)
 *   - search: Search term for username, email, or display name
 *   - approval_status: Filter by approval status ('all', 'approved', 'pending')
 */
router.get('/users', getAllUsers);

/**
 * GET /api/admin/users/pending
 * Get all users pending approval
 * Returns list of users where is_approved = 0
 */
router.get('/users/pending', getPendingUsers);

/**
 * GET /api/admin/users/:userId
 * Get a single user by ID
 */
router.get('/users/:userId', getUserById);

/**
 * POST /api/admin/users
 * Create a new user
 * Body:
 *   - username: Required, 3-30 chars, alphanumeric + underscore/dash
 *   - email: Required, valid email format
 *   - password: Required, min 8 chars with uppercase, lowercase, and number
 *   - display_name: Optional, max 100 chars
 *   - role: Required, one of: super_admin, admin, member
 */
router.post('/users', createUserLimiter, createUser);

/**
 * POST /api/admin/users/:userId/approve
 * Approve a pending user registration
 * Creates their default workspace and sends approval email
 */
router.post('/users/:userId/approve', approvalLimiter, approveUser);

/**
 * POST /api/admin/users/:userId/reject
 * Reject a pending user registration
 * Deletes the user record and sends rejection email
 */
router.post('/users/:userId/reject', approvalLimiter, rejectUser);

/**
 * DELETE /api/admin/users/:userId
 * Delete a user
 * Restrictions:
 *   - Cannot delete self
 *   - Cannot delete other Super Admins
 */
router.delete('/users/:userId', deleteUser);

export default router;
