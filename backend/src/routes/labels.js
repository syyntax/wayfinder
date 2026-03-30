import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
    getLabels,
    createLabel,
    updateLabel,
    deleteLabel
} from '../controllers/labelController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get all labels for a board
router.get('/board/:boardId', [
    param('boardId').notEmpty().withMessage('Board ID is required'),
    validate
], getLabels);

// Create a new label
router.post('/', [
    body('boardId').notEmpty().withMessage('Board ID is required'),
    body('name').trim().notEmpty().withMessage('Label name is required'),
    body('color').matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color format (must be hex color)'),
    validate
], createLabel);

// Update a label
router.patch('/:id', [
    param('id').notEmpty().withMessage('Label ID is required'),
    body('name').optional().trim().notEmpty().withMessage('Label name cannot be empty'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color format'),
    validate
], updateLabel);

// Delete a label
router.delete('/:id', [
    param('id').notEmpty().withMessage('Label ID is required'),
    validate
], deleteLabel);

export default router;
