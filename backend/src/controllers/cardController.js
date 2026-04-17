import { getDatabase } from '../db/database.js';
import { generateId, apiResponse } from '../utils/helpers.js';
import {
    createNotificationsForUsers,
    getCardMembers,
    getUserDisplayName,
    getLabelInfo
} from '../services/notificationService.js';

/**
 * Get a single card with full details
 */
export function getCard(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id
            FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(id);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        // Check access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Get labels
        card.labels = db.prepare(`
            SELECT l.* FROM labels l
            JOIN card_labels cl ON l.id = cl.label_id
            WHERE cl.card_id = ?
        `).all(id);

        // Get assignees
        card.assignees = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url FROM users u
            JOIN card_assignees ca ON u.id = ca.user_id
            WHERE ca.card_id = ?
        `).all(id);

        // Get checklists with items
        card.checklists = db.prepare('SELECT * FROM checklists WHERE card_id = ? ORDER BY position').all(id);
        for (const checklist of card.checklists) {
            checklist.items = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position').all(checklist.id);
        }

        // Get comments
        card.comments = db.prepare(`
            SELECT c.*, u.username, u.display_name, u.avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.card_id = ?
            ORDER BY c.created_at DESC
        `).all(id);

        // Get activity
        card.activity = db.prepare(`
            SELECT a.*, u.username, u.display_name
            FROM activity_log a
            JOIN users u ON a.user_id = u.id
            WHERE a.card_id = ?
            ORDER BY a.created_at DESC
            LIMIT 50
        `).all(id);

        // Get creator info
        const creator = db.prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ?').get(card.created_by);
        card.creator = creator;

        res.json(apiResponse(true, { card }));

    } catch (error) {
        console.error('Get card error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get card'));
    }
}

/**
 * Create a new card
 */
export function createCard(req, res) {
    try {
        const { title, listId, description, dueDate, priority, coverImage } = req.body;
        const db = getDatabase();

        // Check list/board access
        const list = db.prepare(`
            SELECT l.*, b.workspace_id FROM lists l
            JOIN boards b ON l.board_id = b.id
            WHERE l.id = ?
        `).get(listId);

        if (!list) {
            return res.status(404).json(apiResponse(false, null, 'List not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(list.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Get max position
        const maxPos = db.prepare('SELECT MAX(position) as max FROM cards WHERE list_id = ?').get(listId);
        const position = (maxPos.max || 0) + 1;

        const cardId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO cards (id, list_id, title, description, cover_image, position, due_date, priority, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(cardId, listId, title, description || '', coverImage || null, position, dueDate || null, priority || 'none', req.user.id, now, now);

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, ?, 'card_created', ?, ?)
        `).run(generateId(), req.user.id, list.board_id, cardId, JSON.stringify({ cardTitle: title }), now);

        const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
        card.labels = [];
        card.assignees = [];
        card.comment_count = 0;
        card.checklist_total = 0;
        card.checklist_completed = 0;

        res.status(201).json(apiResponse(true, { card }, 'Card created'));

    } catch (error) {
        console.error('Create card error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to create card'));
    }
}

/**
 * Update a card
 */
export function updateCard(req, res) {
    try {
        const { id } = req.params;
        // Support both camelCase and snake_case for cover_image to handle frontend inconsistencies
        const { title, description, dueDate, priority, status, coverImage, cover_image } = req.body;
        // Use coverImage if provided, otherwise fall back to cover_image (snake_case)
        const resolvedCoverImage = coverImage !== undefined ? coverImage : cover_image;
        const db = getDatabase();

        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(id);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const updates = [];
        const values = [];
        const changes = {};

        if (title !== undefined) {
            updates.push('title = ?');
            values.push(title);
            changes.title = { from: card.title, to: title };
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (resolvedCoverImage !== undefined) {
            // Allow null/empty to clear the cover image
            updates.push('cover_image = ?');
            values.push(resolvedCoverImage || null);
            changes.coverImage = { from: card.cover_image, to: resolvedCoverImage };
        }
        if (dueDate !== undefined) {
            updates.push('due_date = ?');
            values.push(dueDate);
            changes.dueDate = { from: card.due_date, to: dueDate };
        }
        if (priority !== undefined) {
            updates.push('priority = ?');
            values.push(priority);
            changes.priority = { from: card.priority, to: priority };
        }
        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
            changes.status = { from: card.status, to: status };
        }

        if (updates.length === 0) {
            return res.status(400).json(apiResponse(false, null, 'No fields to update'));
        }

        const now = new Date().toISOString();
        updates.push('updated_at = ?');
        values.push(now);
        values.push(id);

        db.prepare(`UPDATE cards SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        // Log activity
        if (Object.keys(changes).length > 0) {
            db.prepare(`
                INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
                VALUES (?, ?, ?, ?, 'card_updated', ?, ?)
            `).run(generateId(), req.user.id, card.board_id, id, JSON.stringify(changes), now);
        }

        // Send priority change notification to card members
        if (changes.priority) {
            const cardMembers = getCardMembers(id);
            const actorName = getUserDisplayName(req.user.id);
            const priorityDisplay = changes.priority.to === 'none' ? 'None' :
                changes.priority.to.charAt(0).toUpperCase() + changes.priority.to.slice(1);

            createNotificationsForUsers(
                cardMembers,
                'priority_changed',
                `Priority changed on "${card.title}"`,
                `${actorName} changed priority to ${priorityDisplay}`,
                'card',
                id,
                card.title,
                req.user.id
            );
        }

        const updatedCard = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);

        res.json(apiResponse(true, { card: updatedCard }, 'Card updated'));

    } catch (error) {
        console.error('Update card error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update card'));
    }
}

/**
 * Move a card to a different list and/or position
 */
export function moveCard(req, res) {
    try {
        const { id } = req.params;
        const { listId, position } = req.body;
        const db = getDatabase();

        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(id);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        // Check access to source
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // If moving to different list, verify it's in same board
        if (listId && listId !== card.list_id) {
            const targetList = db.prepare('SELECT * FROM lists WHERE id = ? AND board_id = ?').get(listId, card.board_id);
            if (!targetList) {
                return res.status(400).json(apiResponse(false, null, 'Target list must be in the same board'));
            }
        }

        const targetListId = listId || card.list_id;
        const now = new Date().toISOString();

        // Update card position
        const transaction = db.transaction(() => {
            // Get current cards in target list
            const cardsInList = db.prepare(`
                SELECT id, position FROM cards
                WHERE list_id = ? AND id != ? AND is_archived = 0
                ORDER BY position
            `).all(targetListId, id);

            // Insert card at new position and shift others
            const newPosition = Math.min(Math.max(0, position), cardsInList.length);

            let pos = 0;
            for (const c of cardsInList) {
                if (pos === newPosition) pos++;
                db.prepare('UPDATE cards SET position = ? WHERE id = ?').run(pos, c.id);
                pos++;
            }

            // Update the moved card
            db.prepare('UPDATE cards SET list_id = ?, position = ?, updated_at = ? WHERE id = ?')
                .run(targetListId, newPosition, now, id);

            // Log if list changed
            if (listId && listId !== card.list_id) {
                const fromList = db.prepare('SELECT name FROM lists WHERE id = ?').get(card.list_id);
                const toList = db.prepare('SELECT name FROM lists WHERE id = ?').get(listId);

                db.prepare(`
                    INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
                    VALUES (?, ?, ?, ?, 'card_moved', ?, ?)
                `).run(generateId(), req.user.id, card.board_id, id, JSON.stringify({
                    from: fromList?.name,
                    to: toList?.name
                }), now);
            }
        });

        transaction();

        res.json(apiResponse(true, null, 'Card moved'));

    } catch (error) {
        console.error('Move card error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to move card'));
    }
}

/**
 * Add/remove label from card
 */
export function updateCardLabels(req, res) {
    try {
        const { id } = req.params;
        const { labelId, action } = req.body; // action: 'add' or 'remove'
        const db = getDatabase();

        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(id);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Verify label belongs to same board
        const label = db.prepare('SELECT * FROM labels WHERE id = ? AND board_id = ?').get(labelId, card.board_id);
        if (!label) {
            return res.status(404).json(apiResponse(false, null, 'Label not found'));
        }

        if (action === 'add') {
            db.prepare('INSERT OR IGNORE INTO card_labels (card_id, label_id) VALUES (?, ?)').run(id, labelId);

            // Create notification for label added
            const cardMembers = getCardMembers(id);
            const actorName = getUserDisplayName(req.user.id);
            const labelName = label.name || label.color;

            createNotificationsForUsers(
                cardMembers,
                'label_added',
                `Label added to "${card.title}"`,
                `${actorName} added label "${labelName}"`,
                'card',
                id,
                card.title,
                req.user.id
            );
        } else if (action === 'remove') {
            db.prepare('DELETE FROM card_labels WHERE card_id = ? AND label_id = ?').run(id, labelId);

            // Create notification for label removed
            const cardMembers = getCardMembers(id);
            const actorName = getUserDisplayName(req.user.id);
            const labelName = label.name || label.color;

            createNotificationsForUsers(
                cardMembers,
                'label_removed',
                `Label removed from "${card.title}"`,
                `${actorName} removed label "${labelName}"`,
                'card',
                id,
                card.title,
                req.user.id
            );
        }

        // Get updated labels
        const labels = db.prepare(`
            SELECT l.* FROM labels l
            JOIN card_labels cl ON l.id = cl.label_id
            WHERE cl.card_id = ?
        `).all(id);

        res.json(apiResponse(true, { labels }, 'Labels updated'));

    } catch (error) {
        console.error('Update card labels error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update labels'));
    }
}

/**
 * Add/remove assignee from card
 */
export function updateCardAssignees(req, res) {
    try {
        const { id } = req.params;
        const { userId, action } = req.body; // action: 'add' or 'remove'
        const db = getDatabase();

        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(id);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Verify user exists and is in workspace
        const user = db.prepare(`
            SELECT u.id, u.username, u.display_name FROM users u
            JOIN workspace_members wm ON u.id = wm.user_id
            WHERE u.id = ? AND wm.workspace_id = ?
        `).get(userId, card.workspace_id);

        if (!user) {
            return res.status(404).json(apiResponse(false, null, 'User not found in workspace'));
        }

        const now = new Date().toISOString();

        if (action === 'add') {
            db.prepare('INSERT OR IGNORE INTO card_assignees (card_id, user_id, assigned_at) VALUES (?, ?, ?)').run(id, userId, now);

            // Log activity
            db.prepare(`
                INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
                VALUES (?, ?, ?, ?, 'assignee_added', ?, ?)
            `).run(generateId(), req.user.id, card.board_id, id, JSON.stringify({ assignee: user.display_name || user.username }), now);
        } else if (action === 'remove') {
            db.prepare('DELETE FROM card_assignees WHERE card_id = ? AND user_id = ?').run(id, userId);

            // Log activity
            db.prepare(`
                INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
                VALUES (?, ?, ?, ?, 'assignee_removed', ?, ?)
            `).run(generateId(), req.user.id, card.board_id, id, JSON.stringify({ assignee: user.display_name || user.username }), now);
        }

        // Get updated assignees
        const assignees = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url FROM users u
            JOIN card_assignees ca ON u.id = ca.user_id
            WHERE ca.card_id = ?
        `).all(id);

        res.json(apiResponse(true, { assignees }, 'Assignees updated'));

    } catch (error) {
        console.error('Update card assignees error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update assignees'));
    }
}

/**
 * Delete (archive) a card
 */
export function deleteCard(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(id);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const now = new Date().toISOString();
        db.prepare('UPDATE cards SET is_archived = 1, updated_at = ? WHERE id = ?').run(now, id);

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, ?, 'card_archived', ?, ?)
        `).run(generateId(), req.user.id, card.board_id, id, JSON.stringify({ cardTitle: card.title }), now);

        res.json(apiResponse(true, null, 'Card archived'));

    } catch (error) {
        console.error('Delete card error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete card'));
    }
}

export default {
    getCard,
    createCard,
    updateCard,
    moveCard,
    updateCardLabels,
    updateCardAssignees,
    deleteCard
};
