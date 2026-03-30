import { Router } from 'express';
import { getWorkspaces, getWorkspace, createWorkspace, updateWorkspace, inviteToWorkspace, removeMember, searchUsers } from '../controllers/workspaceController.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Search users (for invitation)
router.get('/users/search', [
    query('q').optional().isLength({ min: 2, max: 100 }),
    handleValidationErrors
], searchUsers);

// Get all workspaces
router.get('/', getWorkspaces);

// Get single workspace
router.get('/:id', [
    param('id').isUUID().withMessage('Invalid workspace ID'),
    handleValidationErrors
], getWorkspace);

// Create workspace
router.post('/', [
    body('name').isLength({ min: 1, max: 100 }).trim().withMessage('Workspace name required (1-100 chars)'),
    body('description').optional().isLength({ max: 500 }),
    handleValidationErrors
], createWorkspace);

// Update workspace
router.patch('/:id', [
    param('id').isUUID().withMessage('Invalid workspace ID'),
    body('name').optional().isLength({ min: 1, max: 100 }).trim(),
    body('description').optional().isLength({ max: 500 }),
    handleValidationErrors
], updateWorkspace);

// Invite member to workspace
router.post('/:id/invite', [
    param('id').isUUID().withMessage('Invalid workspace ID'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('role').optional().isIn(['admin', 'member']).withMessage('Role must be admin or member'),
    handleValidationErrors
], inviteToWorkspace);

// Remove member from workspace
router.delete('/:id/members/:userId', [
    param('id').isUUID().withMessage('Invalid workspace ID'),
    param('userId').isUUID().withMessage('Invalid user ID'),
    handleValidationErrors
], removeMember);

export default router;
