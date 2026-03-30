import { Router } from 'express';
import { uploadAvatar, deleteAvatar } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadAvatar as avatarUpload, handleMulterError } from '../middleware/upload.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// POST /api/users/avatar - Upload avatar
router.post('/avatar', avatarUpload.single('avatar'), handleMulterError, uploadAvatar);

// DELETE /api/users/avatar - Delete avatar
router.delete('/avatar', deleteAvatar);

export default router;
