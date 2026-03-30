import { getDatabase } from '../db/database.js';
import { generateId, apiResponse } from '../utils/helpers.js';

/**
 * Get all labels for a board
 */
export function getLabels(req, res) {
    try {
        const { boardId } = req.params;
        const db = getDatabase();

        // Check board access
        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
        if (!board) {
            return res.status(404).json(apiResponse(false, null, 'Board not found'));
        }

        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(board.workspace_id, req.user.id);

        if (!hasAccess && board.visibility === 'private') {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const labels = db.prepare('SELECT * FROM labels WHERE board_id = ? ORDER BY name ASC').all(boardId);

        res.json(apiResponse(true, { labels }));
    } catch (error) {
        console.error('Get labels error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get labels'));
    }
}

/**
 * Create a new label
 */
export function createLabel(req, res) {
    try {
        const { boardId, name, color } = req.body;
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

        const labelId = generateId();

        db.prepare(`
            INSERT INTO labels (id, board_id, name, color)
            VALUES (?, ?, ?, ?)
        `).run(labelId, boardId, name, color);

        const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(labelId);

        res.status(201).json(apiResponse(true, { label }, 'Label created'));
    } catch (error) {
        console.error('Create label error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to create label'));
    }
}

/**
 * Update a label
 */
export function updateLabel(req, res) {
    try {
        const { id } = req.params;
        const { name, color } = req.body;
        const db = getDatabase();

        // Get label and board
        const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(id);
        if (!label) {
            return res.status(404).json(apiResponse(false, null, 'Label not found'));
        }

        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(label.board_id);

        // Check access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(board.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (color !== undefined) {
            updates.push('color = ?');
            values.push(color);
        }

        if (updates.length === 0) {
            return res.status(400).json(apiResponse(false, null, 'No fields to update'));
        }

        values.push(id);

        db.prepare(`UPDATE labels SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        const updatedLabel = db.prepare('SELECT * FROM labels WHERE id = ?').get(id);

        res.json(apiResponse(true, { label: updatedLabel }, 'Label updated'));
    } catch (error) {
        console.error('Update label error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update label'));
    }
}

/**
 * Delete a label
 */
export function deleteLabel(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        // Get label and board
        const label = db.prepare('SELECT * FROM labels WHERE id = ?').get(id);
        if (!label) {
            return res.status(404).json(apiResponse(false, null, 'Label not found'));
        }

        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(label.board_id);

        // Check access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(board.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Delete card_labels associations first
        db.prepare('DELETE FROM card_labels WHERE label_id = ?').run(id);

        // Delete the label
        db.prepare('DELETE FROM labels WHERE id = ?').run(id);

        res.json(apiResponse(true, null, 'Label deleted'));
    } catch (error) {
        console.error('Delete label error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete label'));
    }
}

export default {
    getLabels,
    createLabel,
    updateLabel,
    deleteLabel
};
