import { getDatabase } from '../db/database.js';
import { generateId, apiResponse } from '../utils/helpers.js';
import {
    createNotificationsForUsers,
    getCardMembers,
    getCardInfo,
    getUserDisplayName
} from '../services/notificationService.js';

/**
 * Get comments for a card
 */
export function getComments(req, res) {
    try {
        const { cardId } = req.params;
        const db = getDatabase();

        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(cardId);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const comments = db.prepare(`
            SELECT c.*, u.username, u.display_name, u.avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.card_id = ?
            ORDER BY c.created_at DESC
        `).all(cardId);

        res.json(apiResponse(true, { comments }));

    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get comments'));
    }
}

/**
 * Create a comment
 */
export function createComment(req, res) {
    try {
        const { cardId, content } = req.body;
        const db = getDatabase();

        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(cardId);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const commentId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO comments (id, card_id, user_id, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(commentId, cardId, req.user.id, content, now, now);

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, ?, 'comment_added', ?, ?)
        `).run(generateId(), req.user.id, card.board_id, cardId, JSON.stringify({ preview: content.substring(0, 100) }), now);

        const comment = db.prepare(`
            SELECT c.*, u.username, u.display_name, u.avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `).get(commentId);

        // Create notifications for card members (except the commenter)
        const cardMembers = getCardMembers(cardId);
        const actorName = getUserDisplayName(req.user.id);
        const commentPreview = content.length > 50 ? content.substring(0, 50) + '...' : content;

        createNotificationsForUsers(
            cardMembers,
            'comment_added',
            `New comment on "${card.title}"`,
            `${actorName} commented: "${commentPreview}"`,
            'card',
            cardId,
            card.title,
            req.user.id
        );

        res.status(201).json(apiResponse(true, { comment }, 'Comment added'));

    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to create comment'));
    }
}

/**
 * Update a comment
 */
export function updateComment(req, res) {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const db = getDatabase();

        const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
        if (!comment) {
            return res.status(404).json(apiResponse(false, null, 'Comment not found'));
        }

        // Only comment author can edit
        if (comment.user_id !== req.user.id && req.user.role !== 'super_admin') {
            return res.status(403).json(apiResponse(false, null, 'You can only edit your own comments'));
        }

        const now = new Date().toISOString();
        db.prepare('UPDATE comments SET content = ?, is_edited = 1, updated_at = ? WHERE id = ?')
            .run(content, now, id);

        const updatedComment = db.prepare(`
            SELECT c.*, u.username, u.display_name, u.avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `).get(id);

        res.json(apiResponse(true, { comment: updatedComment }, 'Comment updated'));

    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update comment'));
    }
}

/**
 * Delete a comment
 */
export function deleteComment(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
        if (!comment) {
            return res.status(404).json(apiResponse(false, null, 'Comment not found'));
        }

        // Only comment author or super admin can delete
        if (comment.user_id !== req.user.id && req.user.role !== 'super_admin') {
            return res.status(403).json(apiResponse(false, null, 'You can only delete your own comments'));
        }

        db.prepare('DELETE FROM comments WHERE id = ?').run(id);

        res.json(apiResponse(true, null, 'Comment deleted'));

    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete comment'));
    }
}

export default {
    getComments,
    createComment,
    updateComment,
    deleteComment
};
