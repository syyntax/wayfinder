import { apiResponse } from '../utils/helpers.js';
import {
    getNotifications as getNotificationsService,
    getUnreadCount as getUnreadCountService,
    markAsRead as markAsReadService,
    markAllAsRead as markAllAsReadService,
    deleteNotification as deleteNotificationService
} from '../services/notificationService.js';

/**
 * Get notifications for the current user
 * GET /api/notifications
 * Query params: limit, offset, unread_only
 */
export function getNotifications(req, res) {
    try {
        const { limit = 20, offset = 0, unread_only } = req.query;

        const options = {
            limit: Math.min(parseInt(limit) || 20, 100), // Max 100
            offset: parseInt(offset) || 0,
            unreadOnly: unread_only === 'true'
        };

        const result = getNotificationsService(req.user.id, options);

        res.json(apiResponse(true, result));

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get notifications'));
    }
}

/**
 * Get unread notification count for the current user
 * GET /api/notifications/unread-count
 */
export function getUnreadCount(req, res) {
    try {
        const count = getUnreadCountService(req.user.id);

        res.json(apiResponse(true, { count }));

    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get unread count'));
    }
}

/**
 * Mark a single notification as read
 * PATCH /api/notifications/:id/read
 */
export function markAsRead(req, res) {
    try {
        const { id } = req.params;

        const success = markAsReadService(id, req.user.id);

        if (!success) {
            return res.status(404).json(apiResponse(false, null, 'Notification not found or already read'));
        }

        res.json(apiResponse(true, null, 'Notification marked as read'));

    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to mark notification as read'));
    }
}

/**
 * Mark all notifications as read for the current user
 * PATCH /api/notifications/mark-all-read
 */
export function markAllAsRead(req, res) {
    try {
        const count = markAllAsReadService(req.user.id);

        res.json(apiResponse(true, { count }, `${count} notifications marked as read`));

    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to mark notifications as read'));
    }
}

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
export function deleteNotification(req, res) {
    try {
        const { id } = req.params;

        const success = deleteNotificationService(id, req.user.id);

        if (!success) {
            return res.status(404).json(apiResponse(false, null, 'Notification not found'));
        }

        res.json(apiResponse(true, null, 'Notification deleted'));

    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete notification'));
    }
}

export default {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
};
