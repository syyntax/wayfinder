import { Router } from 'express';
import { param } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { handleValidationErrors } from '../middleware/validators.js';
import { uploadAttachment, uploadCover, handleMulterError } from '../middleware/upload.js';
import {
    uploadAttachments,
    getCardAttachments,
    deleteAttachment,
    uploadCardCover,
    uploadBoardCover
} from '../controllers/attachmentController.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/cards/:cardId/attachments
 * Upload file attachments to a card
 */
router.post('/cards/:cardId/attachments',
    [
        param('cardId').isUUID().withMessage('Invalid card ID'),
        handleValidationErrors
    ],
    uploadAttachment.array('files', 5),
    handleMulterError,
    uploadAttachments
);

/**
 * GET /api/cards/:cardId/attachments
 * Get all attachments for a card
 */
router.get('/cards/:cardId/attachments',
    [
        param('cardId').isUUID().withMessage('Invalid card ID'),
        handleValidationErrors
    ],
    getCardAttachments
);

/**
 * DELETE /api/attachments/:attachmentId
 * Delete an attachment
 */
router.delete('/attachments/:attachmentId',
    [
        param('attachmentId').isUUID().withMessage('Invalid attachment ID'),
        handleValidationErrors
    ],
    deleteAttachment
);

/**
 * POST /api/cards/:cardId/cover
 * Upload a cover image for a card
 */
router.post('/cards/:cardId/cover',
    [
        param('cardId').isUUID().withMessage('Invalid card ID'),
        handleValidationErrors
    ],
    uploadCover.single('cover'),
    handleMulterError,
    uploadCardCover
);

/**
 * POST /api/boards/:boardId/cover
 * Upload a cover image for a board
 */
router.post('/boards/:boardId/cover',
    [
        param('boardId').isUUID().withMessage('Invalid board ID'),
        handleValidationErrors
    ],
    uploadCover.single('cover'),
    handleMulterError,
    uploadBoardCover
);

export default router;
