import { Router } from 'express';
import { getComments, createComment, updateComment, deleteComment } from '../controllers/commentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get comments for a card
router.get('/card/:cardId', [
    param('cardId').isUUID().withMessage('Invalid card ID'),
    handleValidationErrors
], getComments);

// Create comment
router.post('/', [
    body('cardId').isUUID().withMessage('Valid card ID required'),
    body('content').isLength({ min: 1, max: 2000 }).trim().withMessage('Comment required (1-2000 chars)'),
    handleValidationErrors
], createComment);

// Update comment
router.patch('/:id', [
    param('id').isUUID().withMessage('Invalid comment ID'),
    body('content').isLength({ min: 1, max: 2000 }).trim().withMessage('Comment required (1-2000 chars)'),
    handleValidationErrors
], updateComment);

// Delete comment
router.delete('/:id', [
    param('id').isUUID().withMessage('Invalid comment ID'),
    handleValidationErrors
], deleteComment);

export default router;
