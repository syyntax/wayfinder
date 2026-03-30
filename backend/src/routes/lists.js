import { Router } from 'express';
import { createList, updateList, reorderLists, deleteList } from '../controllers/listController.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create list
router.post('/', [
    body('name').isLength({ min: 1, max: 100 }).trim().withMessage('List name required (1-100 chars)'),
    body('boardId').isUUID().withMessage('Valid board ID required'),
    handleValidationErrors
], createList);

// Update list
router.patch('/:id', [
    param('id').isUUID().withMessage('Invalid list ID'),
    body('name').optional().isLength({ min: 1, max: 100 }).trim(),
    body('isCollapsed').optional().isBoolean(),
    handleValidationErrors
], updateList);

// Reorder lists
router.post('/reorder', [
    body('boardId').isUUID().withMessage('Valid board ID required'),
    body('listOrder').isArray().withMessage('List order must be an array'),
    body('listOrder.*').isUUID().withMessage('Invalid list ID in order'),
    handleValidationErrors
], reorderLists);

// Delete (archive) list
router.delete('/:id', [
    param('id').isUUID().withMessage('Invalid list ID'),
    handleValidationErrors
], deleteList);

export default router;
