import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from '../controllers/notificationController.js';

const router = express.Router();

// All notification routes require authentication
router.use(authenticateToken);

// GET /api/notifications - Get notifications (paginated)
// Query params: limit (default: 20), offset (default: 0), unread_only (boolean)
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', getUnreadCount);

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', markAllAsRead);

// PATCH /api/notifications/:id/read - Mark a single notification as read
router.patch('/:id/read', markAsRead);

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', deleteNotification);

export default router;
