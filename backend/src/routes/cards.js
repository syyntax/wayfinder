import { Router } from 'express';
import { getCard, createCard, updateCard, moveCard, updateCardLabels, updateCardAssignees, deleteCard } from '../controllers/cardController.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get single card with full details
router.get('/:id', [
    param('id').isUUID().withMessage('Invalid card ID'),
    handleValidationErrors
], getCard);

// Create card
router.post('/', [
    body('title').isLength({ min: 1, max: 200 }).trim().withMessage('Card title required (1-200 chars)'),
    body('listId').isUUID().withMessage('Valid list ID required'),
    body('description').optional().isLength({ max: 100000 }),
    body('dueDate').optional().isISO8601(),
    body('priority').optional().isString().isLength({ max: 50 }).withMessage('Invalid priority'),
    handleValidationErrors
], createCard);

// Update card
router.patch('/:id', [
    param('id').isUUID().withMessage('Invalid card ID'),
    body('title').optional().isLength({ min: 1, max: 200 }).trim(),
    body('description').optional().isLength({ max: 100000 }),
    body('dueDate').optional({ nullable: true }).isISO8601(),
    body('priority').optional().isString().isLength({ max: 50 }).withMessage('Invalid priority'),
    body('status').optional().isIn(['active', 'blocked', 'in_review', 'complete']),
    body('coverImage').optional({ nullable: true }).isString().isLength({ max: 2000 }),
    body('cover_image').optional({ nullable: true }).isString().isLength({ max: 2000 }),
    handleValidationErrors
], updateCard);

// Move card to different list/position
router.post('/:id/move', [
    param('id').isUUID().withMessage('Invalid card ID'),
    body('listId').optional().isUUID().withMessage('Invalid list ID'),
    body('position').isInt({ min: 0 }).withMessage('Position must be a non-negative integer'),
    handleValidationErrors
], moveCard);

// Update card labels
router.post('/:id/labels', [
    param('id').isUUID().withMessage('Invalid card ID'),
    body('labelId').isUUID().withMessage('Valid label ID required'),
    body('action').isIn(['add', 'remove']).withMessage('Action must be add or remove'),
    handleValidationErrors
], updateCardLabels);

// Update card assignees
router.post('/:id/assignees', [
    param('id').isUUID().withMessage('Invalid card ID'),
    body('userId').isUUID().withMessage('Valid user ID required'),
    body('action').isIn(['add', 'remove']).withMessage('Action must be add or remove'),
    handleValidationErrors
], updateCardAssignees);

// Delete (archive) card
router.delete('/:id', [
    param('id').isUUID().withMessage('Invalid card ID'),
    handleValidationErrors
], deleteCard);

export default router;
