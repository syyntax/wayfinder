import { getDatabase } from '../db/database.js';
import { generateId } from '../utils/helpers.js';

/**
 * Create a new notification
 * @param {string} userId - The user who receives the notification
 * @param {string} type - Type of notification (comment_added, priority_changed, etc.)
 * @param {string} title - Brief notification title
 * @param {string} message - Notification message
 * @param {string} entityType - Type of entity (card, workspace)
 * @param {string} entityId - ID of the entity
 * @param {string} entityName - Name of the entity (card title or workspace name)
 * @param {string} actorId - The user who triggered the notification
 * @returns {object|null} Created notification or null if actor is the recipient
 */
export function createNotification(userId, type, title, message, entityType, entityId, entityName, actorId) {
    // Don't notify the actor (person who performed action)
    if (userId === actorId) {
        return null;
    }

    const db = getDatabase();
    const notificationId = generateId();
    const now = new Date().toISOString();

    try {
        db.prepare(`
            INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id, entity_name, actor_id, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `).run(notificationId, userId, type, title, message, entityType, entityId, entityName, actorId, now);

        return {
            id: notificationId,
            user_id: userId,
            type,
            title,
            message,
            entity_type: entityType,
            entity_id: entityId,
            entity_name: entityName,
            actor_id: actorId,
            is_read: 0,
            created_at: now
        };
    } catch (error) {
        console.error('Failed to create notification:', error);
        return null;
    }
}

/**
 * Create notifications for multiple users
 * @param {string[]} userIds - Array of user IDs to notify
 * @param {string} type - Type of notification
 * @param {string} title - Brief notification title
 * @param {string} message - Notification message
 * @param {string} entityType - Type of entity
 * @param {string} entityId - ID of the entity
 * @param {string} entityName - Name of the entity
 * @param {string} actorId - The user who triggered the notification
 * @returns {object[]} Array of created notifications
 */
export function createNotificationsForUsers(userIds, type, title, message, entityType, entityId, entityName, actorId) {
    const notifications = [];

    for (const userId of userIds) {
        const notification = createNotification(userId, type, title, message, entityType, entityId, entityName, actorId);
        if (notification) {
            notifications.push(notification);
        }
    }

    return notifications;
}

/**
 * Get notifications for a user
 * @param {string} userId - The user ID
 * @param {object} options - Query options
 * @param {number} options.limit - Maximum number of notifications to return (default: 20)
 * @param {number} options.offset - Number of notifications to skip (default: 0)
 * @param {boolean} options.unreadOnly - Only return unread notifications (default: false)
 * @param {string} options.type - Filter by notification type
 * @returns {object} { notifications, total, hasMore }
 */
export function getNotifications(userId, options = {}) {
    const db = getDatabase();
    const { limit = 20, offset = 0, unreadOnly = false, type = null } = options;

    let whereClause = 'WHERE n.user_id = ?';
    const params = [userId];

    if (unreadOnly) {
        whereClause += ' AND n.is_read = 0';
    }

    if (type) {
        whereClause += ' AND n.type = ?';
        params.push(type);
    }

    // Get total count
    const countResult = db.prepare(`
        SELECT COUNT(*) as total FROM notifications n ${whereClause}
    `).get(...params);
    const total = countResult.total;

    // Get notifications with actor info
    const notifications = db.prepare(`
        SELECT
            n.*,
            u.username as actor_username,
            u.display_name as actor_display_name,
            u.avatar_url as actor_avatar_url
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
        notifications,
        total,
        hasMore: offset + notifications.length < total
    };
}

/**
 * Get unread notification count for a user
 * @param {string} userId - The user ID
 * @returns {number} Count of unread notifications
 */
export function getUnreadCount(userId) {
    const db = getDatabase();

    const result = db.prepare(`
        SELECT COUNT(*) as count FROM notifications
        WHERE user_id = ? AND is_read = 0
    `).get(userId);

    return result.count;
}

/**
 * Mark a notification as read
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID (for verification)
 * @returns {boolean} True if successful
 */
export function markAsRead(notificationId, userId) {
    const db = getDatabase();

    const result = db.prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);

    return result.changes > 0;
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - The user ID
 * @returns {number} Number of notifications marked as read
 */
export function markAllAsRead(userId) {
    const db = getDatabase();

    const result = db.prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE user_id = ? AND is_read = 0
    `).run(userId);

    return result.changes;
}

/**
 * Delete a notification
 * @param {string} notificationId - The notification ID
 * @param {string} userId - The user ID (for verification)
 * @returns {boolean} True if successful
 */
export function deleteNotification(notificationId, userId) {
    const db = getDatabase();

    const result = db.prepare(`
        DELETE FROM notifications
        WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);

    return result.changes > 0;
}

/**
 * Delete old read notifications (cleanup utility)
 * @param {number} daysOld - Delete notifications older than this many days
 * @returns {number} Number of notifications deleted
 */
export function deleteOldNotifications(daysOld = 30) {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = db.prepare(`
        DELETE FROM notifications
        WHERE is_read = 1 AND created_at < ?
    `).run(cutoffDate.toISOString());

    return result.changes;
}

/**
 * Get card members (users assigned to a card)
 * @param {string} cardId - The card ID
 * @returns {string[]} Array of user IDs
 */
export function getCardMembers(cardId) {
    const db = getDatabase();

    const members = db.prepare(`
        SELECT user_id FROM card_assignees WHERE card_id = ?
    `).all(cardId);

    return members.map(m => m.user_id);
}

/**
 * Get card info for notification
 * @param {string} cardId - The card ID
 * @returns {object|null} Card info with board_id
 */
export function getCardInfo(cardId) {
    const db = getDatabase();

    return db.prepare(`
        SELECT c.id, c.title, c.list_id, l.board_id, b.workspace_id
        FROM cards c
        JOIN lists l ON c.list_id = l.id
        JOIN boards b ON l.board_id = b.id
        WHERE c.id = ?
    `).get(cardId);
}

/**
 * Get user display name
 * @param {string} userId - The user ID
 * @returns {string} Display name or username
 */
export function getUserDisplayName(userId) {
    const db = getDatabase();

    const user = db.prepare(`
        SELECT display_name, username FROM users WHERE id = ?
    `).get(userId);

    if (!user) return 'Unknown User';
    return user.display_name || user.username;
}

/**
 * Get label info
 * @param {string} labelId - The label ID
 * @returns {object|null} Label info
 */
export function getLabelInfo(labelId) {
    const db = getDatabase();

    return db.prepare(`
        SELECT id, name, color FROM labels WHERE id = ?
    `).get(labelId);
}

/**
 * Get workspace info
 * @param {string} workspaceId - The workspace ID
 * @returns {object|null} Workspace info
 */
export function getWorkspaceInfo(workspaceId) {
    const db = getDatabase();

    return db.prepare(`
        SELECT id, name FROM workspaces WHERE id = ?
    `).get(workspaceId);
}

export default {
    createNotification,
    createNotificationsForUsers,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteOldNotifications,
    getCardMembers,
    getCardInfo,
    getUserDisplayName,
    getLabelInfo,
    getWorkspaceInfo
};
