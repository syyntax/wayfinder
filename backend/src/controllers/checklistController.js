import { getDatabase } from '../db/database.js';
import { generateId, apiResponse } from '../utils/helpers.js';

/**
 * Get checklists for a card
 */
export function getChecklists(req, res) {
    try {
        const { cardId } = req.params;
        const db = getDatabase();

        // Verify card access
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

        const checklists = db.prepare(`
            SELECT * FROM checklists WHERE card_id = ? ORDER BY position
        `).all(cardId);

        for (const checklist of checklists) {
            checklist.items = db.prepare(`
                SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position
            `).all(checklist.id);
        }

        res.json(apiResponse(true, { checklists }));

    } catch (error) {
        console.error('Get checklists error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get checklists'));
    }
}

/**
 * Create a new checklist
 */
export function createChecklist(req, res) {
    try {
        const { cardId, title } = req.body;
        const db = getDatabase();

        // Verify card access
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

        // Get max position
        const maxPos = db.prepare('SELECT MAX(position) as max FROM checklists WHERE card_id = ?').get(cardId);
        const position = (maxPos.max || 0) + 1;

        const checklistId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO checklists (id, card_id, title, position, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(checklistId, cardId, title, position, now);

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, ?, 'checklist_added', ?, ?)
        `).run(generateId(), req.user.id, card.board_id, cardId, JSON.stringify({ title }), now);

        const checklist = db.prepare('SELECT * FROM checklists WHERE id = ?').get(checklistId);
        checklist.items = [];

        res.status(201).json(apiResponse(true, { checklist }, 'Checklist created'));

    } catch (error) {
        console.error('Create checklist error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to create checklist'));
    }
}

/**
 * Update a checklist
 */
export function updateChecklist(req, res) {
    try {
        const { id } = req.params;
        const { title } = req.body;
        const db = getDatabase();

        const checklist = db.prepare(`
            SELECT ch.*, c.list_id, l.board_id, b.workspace_id
            FROM checklists ch
            JOIN cards c ON ch.card_id = c.id
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE ch.id = ?
        `).get(id);

        if (!checklist) {
            return res.status(404).json(apiResponse(false, null, 'Checklist not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(checklist.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        db.prepare('UPDATE checklists SET title = ? WHERE id = ?').run(title, id);

        const updated = db.prepare('SELECT * FROM checklists WHERE id = ?').get(id);
        updated.items = db.prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position').all(id);

        res.json(apiResponse(true, { checklist: updated }, 'Checklist updated'));

    } catch (error) {
        console.error('Update checklist error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update checklist'));
    }
}

/**
 * Delete a checklist
 */
export function deleteChecklist(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const checklist = db.prepare(`
            SELECT ch.*, c.list_id, l.board_id, b.workspace_id
            FROM checklists ch
            JOIN cards c ON ch.card_id = c.id
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE ch.id = ?
        `).get(id);

        if (!checklist) {
            return res.status(404).json(apiResponse(false, null, 'Checklist not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(checklist.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Delete items first, then checklist
        db.prepare('DELETE FROM checklist_items WHERE checklist_id = ?').run(id);
        db.prepare('DELETE FROM checklists WHERE id = ?').run(id);

        res.json(apiResponse(true, null, 'Checklist deleted'));

    } catch (error) {
        console.error('Delete checklist error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete checklist'));
    }
}

/**
 * Add item to checklist
 */
export function addChecklistItem(req, res) {
    try {
        const { checklistId, content } = req.body;
        const db = getDatabase();

        const checklist = db.prepare(`
            SELECT ch.*, c.list_id, l.board_id, b.workspace_id
            FROM checklists ch
            JOIN cards c ON ch.card_id = c.id
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE ch.id = ?
        `).get(checklistId);

        if (!checklist) {
            return res.status(404).json(apiResponse(false, null, 'Checklist not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(checklist.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Get max position
        const maxPos = db.prepare('SELECT MAX(position) as max FROM checklist_items WHERE checklist_id = ?').get(checklistId);
        const position = (maxPos.max || 0) + 1;

        const itemId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO checklist_items (id, checklist_id, content, position, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(itemId, checklistId, content, position, now);

        const item = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(itemId);

        res.status(201).json(apiResponse(true, { item }, 'Item added'));

    } catch (error) {
        console.error('Add checklist item error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to add item'));
    }
}

/**
 * Toggle checklist item completion
 */
export function toggleChecklistItem(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const item = db.prepare(`
            SELECT ci.*, ch.card_id, c.list_id, l.board_id, b.workspace_id
            FROM checklist_items ci
            JOIN checklists ch ON ci.checklist_id = ch.id
            JOIN cards c ON ch.card_id = c.id
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE ci.id = ?
        `).get(id);

        if (!item) {
            return res.status(404).json(apiResponse(false, null, 'Item not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(item.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const now = new Date().toISOString();
        const newStatus = !item.is_completed;

        db.prepare(`
            UPDATE checklist_items
            SET is_completed = ?, completed_at = ?, completed_by = ?
            WHERE id = ?
        `).run(newStatus ? 1 : 0, newStatus ? now : null, newStatus ? req.user.id : null, id);

        const updated = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id);

        res.json(apiResponse(true, { item: updated }));

    } catch (error) {
        console.error('Toggle checklist item error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update item'));
    }
}

/**
 * Update checklist item content
 */
export function updateChecklistItem(req, res) {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const db = getDatabase();

        const item = db.prepare(`
            SELECT ci.*, ch.card_id, c.list_id, l.board_id, b.workspace_id
            FROM checklist_items ci
            JOIN checklists ch ON ci.checklist_id = ch.id
            JOIN cards c ON ch.card_id = c.id
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE ci.id = ?
        `).get(id);

        if (!item) {
            return res.status(404).json(apiResponse(false, null, 'Item not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(item.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        db.prepare('UPDATE checklist_items SET content = ? WHERE id = ?').run(content, id);

        const updated = db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id);

        res.json(apiResponse(true, { item: updated }));

    } catch (error) {
        console.error('Update checklist item error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update item'));
    }
}

/**
 * Delete checklist item
 */
export function deleteChecklistItem(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const item = db.prepare(`
            SELECT ci.*, ch.card_id, c.list_id, l.board_id, b.workspace_id
            FROM checklist_items ci
            JOIN checklists ch ON ci.checklist_id = ch.id
            JOIN cards c ON ch.card_id = c.id
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE ci.id = ?
        `).get(id);

        if (!item) {
            return res.status(404).json(apiResponse(false, null, 'Item not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(item.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        db.prepare('DELETE FROM checklist_items WHERE id = ?').run(id);

        res.json(apiResponse(true, null, 'Item deleted'));

    } catch (error) {
        console.error('Delete checklist item error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete item'));
    }
}

export default {
    getChecklists,
    createChecklist,
    updateChecklist,
    deleteChecklist,
    addChecklistItem,
    toggleChecklistItem,
    updateChecklistItem,
    deleteChecklistItem
};
