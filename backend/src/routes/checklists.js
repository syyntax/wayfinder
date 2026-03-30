import { Router } from 'express';
import {
    getChecklists,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    addChecklistItem,
    toggleChecklistItem,
    updateChecklistItem,
    deleteChecklistItem
} from '../controllers/checklistController.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get checklists for a card
router.get('/card/:cardId', [
    param('cardId').isUUID().withMessage('Invalid card ID'),
    handleValidationErrors
], getChecklists);

// Create checklist
router.post('/', [
    body('cardId').isUUID().withMessage('Valid card ID required'),
    body('title').isLength({ min: 1, max: 100 }).trim().withMessage('Title required (1-100 chars)'),
    handleValidationErrors
], createChecklist);

// Update checklist
router.patch('/:id', [
    param('id').isUUID().withMessage('Invalid checklist ID'),
    body('title').isLength({ min: 1, max: 100 }).trim().withMessage('Title required (1-100 chars)'),
    handleValidationErrors
], updateChecklist);

// Delete checklist
router.delete('/:id', [
    param('id').isUUID().withMessage('Invalid checklist ID'),
    handleValidationErrors
], deleteChecklist);

// Add item to checklist
router.post('/items', [
    body('checklistId').isUUID().withMessage('Valid checklist ID required'),
    body('content').isLength({ min: 1, max: 500 }).trim().withMessage('Content required (1-500 chars)'),
    handleValidationErrors
], addChecklistItem);

// Toggle item completion
router.post('/items/:id/toggle', [
    param('id').isUUID().withMessage('Invalid item ID'),
    handleValidationErrors
], toggleChecklistItem);

// Update item content
router.patch('/items/:id', [
    param('id').isUUID().withMessage('Invalid item ID'),
    body('content').isLength({ min: 1, max: 500 }).trim().withMessage('Content required (1-500 chars)'),
    handleValidationErrors
], updateChecklistItem);

// Delete item
router.delete('/items/:id', [
    param('id').isUUID().withMessage('Invalid item ID'),
    handleValidationErrors
], deleteChecklistItem);

export default router;
