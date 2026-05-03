import { Router } from 'express';
import {
    getBoards,
    getBoard,
    createBoard,
    updateBoard,
    deleteBoard,
    exportBoard,
    importBoard,
    previewImport,
    getBoardPriorities,
    updateBoardPriorities
} from '../controllers/boardController.js';
import { authenticateToken } from '../middleware/auth.js';
import { boardValidation } from '../middleware/validators.js';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get all boards
router.get('/', getBoards);

// Create board
router.post('/', [
    body('name').isLength({ min: 1, max: 100 }).trim().withMessage('Board name required (1-100 chars)'),
    body('workspaceId').isUUID().withMessage('Valid workspace ID required'),
    body('description').optional().isLength({ max: 500 }),
    body('visibility').optional().isIn(['private', 'workspace', 'public']),
    body('backgroundTheme').optional().isLength({ max: 50 }),
    handleValidationErrors
], createBoard);

// Import routes - MUST come before /:id routes to avoid conflict
// Import board from JSON - create new board
router.post('/import', [
    body('workspaceId').isUUID().withMessage('Valid workspace ID required for new board import'),
    handleValidationErrors
], importBoard);

// Preview import data without actually importing
router.post('/import/preview', previewImport);

// Per-board priority configuration (must come before /:id catch-alls)
router.get('/:id/priorities', [
    param('id').isUUID().withMessage('Invalid board ID'),
    handleValidationErrors
], getBoardPriorities);

router.put('/:id/priorities', [
    param('id').isUUID().withMessage('Invalid board ID'),
    handleValidationErrors
], updateBoardPriorities);

// Get single board with lists and cards
router.get('/:id', [
    param('id').isUUID().withMessage('Invalid board ID'),
    handleValidationErrors
], getBoard);

// Update board
router.patch('/:id', [
    param('id').isUUID().withMessage('Invalid board ID'),
    body('name').optional().isLength({ min: 1, max: 100 }).trim(),
    body('description').optional().isLength({ max: 500 }),
    body('visibility').optional().isIn(['private', 'workspace', 'public']),
    body('backgroundTheme').optional().isLength({ max: 50 }),
    body('isStarred').optional().isBoolean(),
    handleValidationErrors
], updateBoard);

// Delete (archive) board
router.delete('/:id', [
    param('id').isUUID().withMessage('Invalid board ID'),
    handleValidationErrors
], deleteBoard);

// Export board to JSON
router.get('/:id/export', [
    param('id').isUUID().withMessage('Invalid board ID'),
    query('includeComments').optional().isIn(['true', 'false']),
    query('includeChecklists').optional().isIn(['true', 'false']),
    query('includeAttachments').optional().isIn(['true', 'false']),
    handleValidationErrors
], exportBoard);

// Import board from JSON - merge into existing board
router.post('/:id/import', [
    param('id').isUUID().withMessage('Invalid board ID'),
    query('mode').optional().isIn(['new', 'merge']),
    handleValidationErrors
], importBoard);

export default router;
