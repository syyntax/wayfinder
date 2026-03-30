import { getDatabase } from '../db/database.js';
import { generateId, apiResponse } from '../utils/helpers.js';

/**
 * Create a new list
 */
export function createList(req, res) {
    try {
        const { name, boardId } = req.body;
        const db = getDatabase();

        // Check board access
        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
        if (!board) {
            return res.status(404).json(apiResponse(false, null, 'Board not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(board.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Get max position
        const maxPos = db.prepare('SELECT MAX(position) as max FROM lists WHERE board_id = ?').get(boardId);
        const position = (maxPos.max || 0) + 1;

        const listId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO lists (id, board_id, name, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(listId, boardId, name, position, now, now);

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, 'list_created', ?, ?)
        `).run(generateId(), req.user.id, boardId, JSON.stringify({ listName: name }), now);

        const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(listId);
        list.cards = [];

        res.status(201).json(apiResponse(true, { list }, 'List created'));

    } catch (error) {
        console.error('Create list error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to create list'));
    }
}

/**
 * Update a list
 */
export function updateList(req, res) {
    try {
        const { id } = req.params;
        const { name, isCollapsed } = req.body;
        const db = getDatabase();

        const list = db.prepare('SELECT l.*, b.workspace_id FROM lists l JOIN boards b ON l.board_id = b.id WHERE l.id = ?').get(id);
        if (!list) {
            return res.status(404).json(apiResponse(false, null, 'List not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(list.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (isCollapsed !== undefined) {
            updates.push('is_collapsed = ?');
            values.push(isCollapsed ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json(apiResponse(false, null, 'No fields to update'));
        }

        updates.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        db.prepare(`UPDATE lists SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        const updatedList = db.prepare('SELECT * FROM lists WHERE id = ?').get(id);

        res.json(apiResponse(true, { list: updatedList }, 'List updated'));

    } catch (error) {
        console.error('Update list error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update list'));
    }
}

/**
 * Reorder lists within a board
 */
export function reorderLists(req, res) {
    try {
        const { boardId, listOrder } = req.body;
        const db = getDatabase();

        // Check board access
        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
        if (!board) {
            return res.status(404).json(apiResponse(false, null, 'Board not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(board.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Update positions
        const updateStmt = db.prepare('UPDATE lists SET position = ?, updated_at = ? WHERE id = ? AND board_id = ?');
        const now = new Date().toISOString();

        const transaction = db.transaction(() => {
            listOrder.forEach((listId, index) => {
                updateStmt.run(index, now, listId, boardId);
            });
        });

        transaction();

        res.json(apiResponse(true, null, 'Lists reordered'));

    } catch (error) {
        console.error('Reorder lists error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to reorder lists'));
    }
}

/**
 * Delete (archive) a list
 */
export function deleteList(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const list = db.prepare('SELECT l.*, b.workspace_id FROM lists l JOIN boards b ON l.board_id = b.id WHERE l.id = ?').get(id);
        if (!list) {
            return res.status(404).json(apiResponse(false, null, 'List not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(list.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Archive the list and its cards
        const now = new Date().toISOString();
        db.prepare('UPDATE lists SET is_archived = 1, updated_at = ? WHERE id = ?').run(now, id);
        db.prepare('UPDATE cards SET is_archived = 1, updated_at = ? WHERE list_id = ?').run(now, id);

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, 'list_archived', ?, ?)
        `).run(generateId(), req.user.id, list.board_id, JSON.stringify({ listName: list.name }), now);

        res.json(apiResponse(true, null, 'List archived'));

    } catch (error) {
        console.error('Delete list error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete list'));
    }
}

export default {
    createList,
    updateList,
    reorderLists,
    deleteList
};
