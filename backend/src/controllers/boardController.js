import { getDatabase } from '../db/database.js';
import { generateId, apiResponse } from '../utils/helpers.js';

/**
 * Get all boards for the current user
 */
export function getBoards(req, res) {
    try {
        const db = getDatabase();
        const { workspaceId } = req.query;

        let boards;
        if (workspaceId) {
            // Get boards for specific workspace
            boards = db.prepare(`
                SELECT b.*,
                    (SELECT COUNT(*) FROM lists WHERE board_id = b.id AND is_archived = 0) as list_count,
                    (SELECT COUNT(*) FROM cards c JOIN lists l ON c.list_id = l.id WHERE l.board_id = b.id AND c.is_archived = 0) as card_count
                FROM boards b
                JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
                WHERE b.workspace_id = ? AND wm.user_id = ? AND b.is_archived = 0
                ORDER BY b.is_starred DESC, b.updated_at DESC
            `).all(workspaceId, req.user.id);
        } else {
            // Get all boards user has access to
            boards = db.prepare(`
                SELECT b.*, w.name as workspace_name,
                    (SELECT COUNT(*) FROM lists WHERE board_id = b.id AND is_archived = 0) as list_count,
                    (SELECT COUNT(*) FROM cards c JOIN lists l ON c.list_id = l.id WHERE l.board_id = b.id AND c.is_archived = 0) as card_count
                FROM boards b
                JOIN workspaces w ON b.workspace_id = w.id
                JOIN workspace_members wm ON b.workspace_id = wm.workspace_id
                WHERE wm.user_id = ? AND b.is_archived = 0
                ORDER BY b.is_starred DESC, b.updated_at DESC
            `).all(req.user.id);
        }

        res.json(apiResponse(true, { boards }));
    } catch (error) {
        console.error('Get boards error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get boards'));
    }
}

/**
 * Get a single board with lists and cards
 */
export function getBoard(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        // Get board
        const board = db.prepare(`
            SELECT b.*, w.name as workspace_name
            FROM boards b
            JOIN workspaces w ON b.workspace_id = w.id
            WHERE b.id = ?
        `).get(id);

        if (!board) {
            return res.status(404).json(apiResponse(false, null, 'Board not found'));
        }

        // Check access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(board.workspace_id, req.user.id);

        if (!hasAccess && board.visibility === 'private') {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Get lists with cards
        const lists = db.prepare(`
            SELECT * FROM lists WHERE board_id = ? AND is_archived = 0 ORDER BY position ASC
        `).all(id);

        // Get cards for each list
        for (const list of lists) {
            list.cards = db.prepare(`
                SELECT c.*,
                    (SELECT COUNT(*) FROM comments WHERE card_id = c.id) as comment_count,
                    (SELECT COUNT(*) FROM checklist_items ci
                     JOIN checklists ch ON ci.checklist_id = ch.id
                     WHERE ch.card_id = c.id) as checklist_total,
                    (SELECT COUNT(*) FROM checklist_items ci
                     JOIN checklists ch ON ci.checklist_id = ch.id
                     WHERE ch.card_id = c.id AND ci.is_completed = 1) as checklist_completed
                FROM cards c
                WHERE c.list_id = ? AND c.is_archived = 0
                ORDER BY c.position ASC
            `).all(list.id);

            // Get labels and assignees for each card
            for (const card of list.cards) {
                card.labels = db.prepare(`
                    SELECT l.* FROM labels l
                    JOIN card_labels cl ON l.id = cl.label_id
                    WHERE cl.card_id = ?
                `).all(card.id);

                card.assignees = db.prepare(`
                    SELECT u.id, u.username, u.display_name, u.avatar_url FROM users u
                    JOIN card_assignees ca ON u.id = ca.user_id
                    WHERE ca.card_id = ?
                `).all(card.id);
            }
        }

        // Get board labels
        const labels = db.prepare('SELECT * FROM labels WHERE board_id = ?').all(id);

        // Get board members
        const members = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, bm.role
            FROM users u
            JOIN board_members bm ON u.id = bm.user_id
            WHERE bm.board_id = ?
        `).all(id);

        // Get workspace members if no board-specific members
        const workspaceMembers = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, wm.role
            FROM users u
            JOIN workspace_members wm ON u.id = wm.user_id
            WHERE wm.workspace_id = ?
        `).all(board.workspace_id);

        res.json(apiResponse(true, {
            board,
            lists,
            labels,
            members: workspaceMembers
        }));

    } catch (error) {
        console.error('Get board error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get board'));
    }
}

/**
 * Create a new board
 */
export function createBoard(req, res) {
    try {
        const { name, description, workspaceId, visibility, backgroundTheme, coverImage } = req.body;
        const db = getDatabase();

        // Check workspace access
        const workspace = db.prepare(`
            SELECT wm.role FROM workspace_members wm
            WHERE wm.workspace_id = ? AND wm.user_id = ?
        `).get(workspaceId, req.user.id);

        if (!workspace) {
            return res.status(403).json(apiResponse(false, null, 'Access denied to workspace'));
        }

        const boardId = generateId();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO boards (id, workspace_id, name, description, background_theme, cover_image, visibility, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(boardId, workspaceId, name, description || '', backgroundTheme || 'cyber-purple', coverImage || null, visibility || 'private', req.user.id, now, now);

        // Add creator as board owner
        db.prepare(`
            INSERT INTO board_members (board_id, user_id, role, joined_at)
            VALUES (?, ?, 'owner', ?)
        `).run(boardId, req.user.id, now);

        // Create default labels
        const defaultLabels = [
            { name: 'Critical', color: '#dc2626' },
            { name: 'High Priority', color: '#f97316' },
            { name: 'Enhancement', color: '#8b5cf6' },
            { name: 'Bug', color: '#ef4444' },
            { name: 'Feature', color: '#06b6d4' },
            { name: 'Documentation', color: '#10b981' }
        ];

        const labelStmt = db.prepare('INSERT INTO labels (id, board_id, name, color) VALUES (?, ?, ?, ?)');
        for (const label of defaultLabels) {
            labelStmt.run(generateId(), boardId, label.name, label.color);
        }

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, 'board_created', ?, ?)
        `).run(generateId(), req.user.id, boardId, JSON.stringify({ boardName: name }), now);

        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);

        res.status(201).json(apiResponse(true, { board }, 'Board created'));

    } catch (error) {
        console.error('Create board error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to create board'));
    }
}

/**
 * Update a board
 */
export function updateBoard(req, res) {
    try {
        const { id } = req.params;
        const { name, description, visibility, backgroundTheme, coverImage, isStarred } = req.body;
        const db = getDatabase();

        // Check access
        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
        if (!board) {
            return res.status(404).json(apiResponse(false, null, 'Board not found'));
        }

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
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (visibility !== undefined) {
            updates.push('visibility = ?');
            values.push(visibility);
        }
        if (backgroundTheme !== undefined) {
            updates.push('background_theme = ?');
            values.push(backgroundTheme);
        }
        if (coverImage !== undefined) {
            // Allow null/empty to clear the cover image
            updates.push('cover_image = ?');
            values.push(coverImage || null);
        }
        if (isStarred !== undefined) {
            updates.push('is_starred = ?');
            values.push(isStarred ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json(apiResponse(false, null, 'No fields to update'));
        }

        updates.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);

        db.prepare(`UPDATE boards SET ${updates.join(', ')} WHERE id = ?`).run(...values);

        const updatedBoard = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);

        res.json(apiResponse(true, { board: updatedBoard }, 'Board updated'));

    } catch (error) {
        console.error('Update board error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update board'));
    }
}

/**
 * Delete (archive) a board
 */
export function deleteBoard(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();

        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
        if (!board) {
            return res.status(404).json(apiResponse(false, null, 'Board not found'));
        }

        // Check if user is owner
        const isOwner = db.prepare(`
            SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ? AND role = 'owner'
        `).get(id, req.user.id);

        const workspaceOwner = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role = 'owner'
        `).get(board.workspace_id, req.user.id);

        if (!isOwner && !workspaceOwner && req.user.role !== 'super_admin') {
            return res.status(403).json(apiResponse(false, null, 'Only board or workspace owners can delete boards'));
        }

        // Archive the board
        db.prepare('UPDATE boards SET is_archived = 1, updated_at = ? WHERE id = ?')
            .run(new Date().toISOString(), id);

        res.json(apiResponse(true, null, 'Board archived'));

    } catch (error) {
        console.error('Delete board error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete board'));
    }
}

/**
 * Export a board to JSON format
 * Includes all lists, cards, labels, comments, checklists, and attachments metadata
 */
export function exportBoard(req, res) {
    try {
        const { id } = req.params;
        const db = getDatabase();
        const {
            includeComments = 'true',
            includeChecklists = 'true',
            includeAttachments = 'true'
        } = req.query;

        // Get board
        const board = db.prepare(`
            SELECT b.*, w.name as workspace_name
            FROM boards b
            JOIN workspaces w ON b.workspace_id = w.id
            WHERE b.id = ?
        `).get(id);

        if (!board) {
            return res.status(404).json(apiResponse(false, null, 'Board not found'));
        }

        // Check if user is board owner/admin or workspace owner/admin
        const boardMember = db.prepare(`
            SELECT role FROM board_members WHERE board_id = ? AND user_id = ?
        `).get(id, req.user.id);

        const workspaceMember = db.prepare(`
            SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(board.workspace_id, req.user.id);

        const canExport =
            boardMember?.role === 'owner' ||
            boardMember?.role === 'admin' ||
            workspaceMember?.role === 'owner' ||
            workspaceMember?.role === 'admin' ||
            req.user.role === 'super_admin';

        if (!canExport) {
            return res.status(403).json(apiResponse(false, null, 'Only board/workspace owners and admins can export boards'));
        }

        // Get all lists
        const lists = db.prepare(`
            SELECT id, name, position, is_collapsed, is_archived, created_at, updated_at
            FROM lists WHERE board_id = ? ORDER BY position ASC
        `).all(id);

        // Get all cards with their data
        for (const list of lists) {
            list.cards = db.prepare(`
                SELECT id, title, description, cover_image, position, due_date,
                       priority, status, is_archived, created_by, created_at, updated_at
                FROM cards WHERE list_id = ? ORDER BY position ASC
            `).all(list.id);

            for (const card of list.cards) {
                // Get card labels (just IDs for now, will map to actual labels)
                card.labels = db.prepare(`
                    SELECT label_id FROM card_labels WHERE card_id = ?
                `).all(card.id).map(cl => cl.label_id);

                // Get card assignees
                card.assignees = db.prepare(`
                    SELECT user_id FROM card_assignees WHERE card_id = ?
                `).all(card.id).map(ca => ca.user_id);

                // Get comments if requested
                if (includeComments === 'true') {
                    card.comments = db.prepare(`
                        SELECT id, user_id, content, is_edited, created_at, updated_at
                        FROM comments WHERE card_id = ? ORDER BY created_at ASC
                    `).all(card.id);
                }

                // Get checklists if requested
                if (includeChecklists === 'true') {
                    card.checklists = db.prepare(`
                        SELECT id, title, position, created_at
                        FROM checklists WHERE card_id = ? ORDER BY position ASC
                    `).all(card.id);

                    for (const checklist of card.checklists) {
                        checklist.items = db.prepare(`
                            SELECT id, content, is_completed, position, completed_at, completed_by, created_at
                            FROM checklist_items WHERE checklist_id = ? ORDER BY position ASC
                        `).all(checklist.id);
                    }
                }

                // Get attachments metadata if requested (not actual files)
                if (includeAttachments === 'true') {
                    card.attachments = db.prepare(`
                        SELECT id, filename, file_size, mime_type,
                               uploaded_by, uploaded_at
                        FROM attachments WHERE card_id = ?
                    `).all(card.id).map(att => ({
                        ...att,
                        note: 'File needs to be re-uploaded after import'
                    }));
                }
            }
        }

        // Get all labels
        const labels = db.prepare(`
            SELECT id, name, color, created_at FROM labels WHERE board_id = ?
        `).all(id);

        // Build export object
        const exportData = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            exported_by: req.user.id,
            board: {
                id: board.id,
                name: board.name,
                description: board.description,
                background_theme: board.background_theme,
                cover_image: board.cover_image,
                visibility: board.visibility,
                lists: lists,
                labels: labels
            }
        };

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, 'board_exported', ?, ?)
        `).run(generateId(), req.user.id, id, JSON.stringify({ boardName: board.name }), new Date().toISOString());

        // Set headers for JSON file download
        const filename = `${board.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-export-${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        res.json(exportData);

    } catch (error) {
        console.error('Export board error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to export board'));
    }
}

/**
 * Import a board from JSON format
 * Can create a new board or merge into an existing board
 */
export function importBoard(req, res) {
    try {
        const { id } = req.params; // Optional - if provided, merge into existing board
        const { mode = 'new' } = req.query; // 'new' or 'merge'
        const importData = req.body;
        const db = getDatabase();

        // Validate import data structure
        if (!importData || !importData.version || !importData.board) {
            return res.status(400).json(apiResponse(false, null, 'Invalid import file format'));
        }

        // Check version compatibility
        const supportedVersions = ['1.0'];
        if (!supportedVersions.includes(importData.version)) {
            return res.status(400).json(apiResponse(false, null, `Unsupported export version: ${importData.version}. Supported versions: ${supportedVersions.join(', ')}`));
        }

        const importBoard = importData.board;

        // Validate required board fields
        if (!importBoard.name || !Array.isArray(importBoard.lists)) {
            return res.status(400).json(apiResponse(false, null, 'Import file missing required board data (name, lists)'));
        }

        let targetBoardId;
        let workspaceId;

        if (mode === 'merge' && id) {
            // Merge into existing board
            const existingBoard = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
            if (!existingBoard) {
                return res.status(404).json(apiResponse(false, null, 'Target board not found'));
            }

            // Check permissions
            const boardMember = db.prepare(`
                SELECT role FROM board_members WHERE board_id = ? AND user_id = ?
            `).get(id, req.user.id);

            const workspaceMember = db.prepare(`
                SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
            `).get(existingBoard.workspace_id, req.user.id);

            const canImport =
                boardMember?.role === 'owner' ||
                boardMember?.role === 'admin' ||
                workspaceMember?.role === 'owner' ||
                workspaceMember?.role === 'admin' ||
                req.user.role === 'super_admin';

            if (!canImport) {
                return res.status(403).json(apiResponse(false, null, 'Only board/workspace owners and admins can import into this board'));
            }

            targetBoardId = id;
            workspaceId = existingBoard.workspace_id;
        } else {
            // Create new board
            const { workspaceId: targetWorkspaceId } = req.body;

            if (!targetWorkspaceId) {
                return res.status(400).json(apiResponse(false, null, 'workspaceId is required when creating a new board'));
            }

            // Check workspace access
            const workspaceMember = db.prepare(`
                SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?
            `).get(targetWorkspaceId, req.user.id);

            if (!workspaceMember) {
                return res.status(403).json(apiResponse(false, null, 'Access denied to workspace'));
            }

            workspaceId = targetWorkspaceId;

            // Check for duplicate board name and add suffix if needed
            let boardName = importBoard.name;
            const existingNames = db.prepare(`
                SELECT name FROM boards WHERE workspace_id = ? AND name LIKE ?
            `).all(workspaceId, `${boardName}%`).map(b => b.name);

            if (existingNames.includes(boardName)) {
                let suffix = 1;
                while (existingNames.includes(`${boardName} (imported${suffix > 1 ? ' ' + suffix : ''})`)) {
                    suffix++;
                }
                boardName = `${boardName} (imported${suffix > 1 ? ' ' + suffix : ''})`;
            }

            // Create the new board
            targetBoardId = generateId();
            const now = new Date().toISOString();

            db.prepare(`
                INSERT INTO boards (id, workspace_id, name, description, background_theme, cover_image, visibility, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                targetBoardId,
                workspaceId,
                boardName,
                importBoard.description || '',
                importBoard.background_theme || 'cyber-purple',
                null, // Don't import cover image URL as it may not be accessible
                importBoard.visibility || 'private',
                req.user.id,
                now,
                now
            );

            // Add creator as board owner
            db.prepare(`
                INSERT INTO board_members (board_id, user_id, role, joined_at)
                VALUES (?, ?, 'owner', ?)
            `).run(targetBoardId, req.user.id, now);
        }

        // Get workspace members for user mapping
        const workspaceMembers = db.prepare(`
            SELECT user_id FROM workspace_members WHERE workspace_id = ?
        `).all(workspaceId).map(wm => wm.user_id);

        // Create ID mappings
        const labelIdMap = new Map();
        const listIdMap = new Map();
        const cardIdMap = new Map();
        const checklistIdMap = new Map();

        const now = new Date().toISOString();

        // Import labels first (needed for card-label relationships)
        if (importBoard.labels && Array.isArray(importBoard.labels)) {
            const labelStmt = db.prepare('INSERT INTO labels (id, board_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)');

            for (const label of importBoard.labels) {
                const newLabelId = generateId();
                labelIdMap.set(label.id, newLabelId);
                labelStmt.run(newLabelId, targetBoardId, label.name || 'Unnamed', label.color || '#8b5cf6', now);
            }
        }

        // Get the highest existing list position for merge mode
        let listPositionOffset = 0;
        if (mode === 'merge') {
            const maxPosition = db.prepare('SELECT MAX(position) as maxPos FROM lists WHERE board_id = ?').get(targetBoardId);
            listPositionOffset = (maxPosition?.maxPos || -1) + 1;
        }

        // Import lists and cards
        const listStmt = db.prepare('INSERT INTO lists (id, board_id, name, position, is_collapsed, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const cardStmt = db.prepare('INSERT INTO cards (id, list_id, title, description, cover_image, position, due_date, priority, status, is_archived, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const cardLabelStmt = db.prepare('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)');
        const cardAssigneeStmt = db.prepare('INSERT INTO card_assignees (card_id, user_id, assigned_at) VALUES (?, ?, ?)');
        const commentStmt = db.prepare('INSERT INTO comments (id, card_id, user_id, content, is_edited, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const checklistStmt = db.prepare('INSERT INTO checklists (id, card_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)');
        const checklistItemStmt = db.prepare('INSERT INTO checklist_items (id, checklist_id, content, is_completed, position, completed_at, completed_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

        let listsImported = 0;
        let cardsImported = 0;
        let commentsImported = 0;
        let checklistsImported = 0;
        let checklistItemsImported = 0;
        const warnings = [];

        for (const list of importBoard.lists) {
            const newListId = generateId();
            listIdMap.set(list.id, newListId);

            listStmt.run(
                newListId,
                targetBoardId,
                list.name || 'Unnamed List',
                (list.position || 0) + listPositionOffset,
                list.is_collapsed ? 1 : 0,
                list.is_archived ? 1 : 0,
                now,
                now
            );
            listsImported++;

            if (list.cards && Array.isArray(list.cards)) {
                for (const card of list.cards) {
                    const newCardId = generateId();
                    cardIdMap.set(card.id, newCardId);

                    // Map creator - use current user if original creator not in workspace
                    const creatorId = workspaceMembers.includes(card.created_by) ? card.created_by : req.user.id;
                    if (card.created_by && !workspaceMembers.includes(card.created_by)) {
                        warnings.push(`Card "${card.title}": original creator not in workspace, assigned to importer`);
                    }

                    cardStmt.run(
                        newCardId,
                        newListId,
                        card.title || 'Untitled Card',
                        card.description || null,
                        null, // Don't import cover images as files may not exist
                        card.position || 0,
                        card.due_date || null,
                        card.priority || 'none',
                        card.status || 'active',
                        card.is_archived ? 1 : 0,
                        creatorId,
                        now,
                        now
                    );
                    cardsImported++;

                    // Import card-label relationships
                    if (card.labels && Array.isArray(card.labels)) {
                        for (const labelId of card.labels) {
                            const newLabelId = labelIdMap.get(labelId);
                            if (newLabelId) {
                                try {
                                    cardLabelStmt.run(newCardId, newLabelId);
                                } catch (e) {
                                    // Ignore duplicate errors
                                }
                            }
                        }
                    }

                    // Import card assignees
                    if (card.assignees && Array.isArray(card.assignees)) {
                        for (const userId of card.assignees) {
                            if (workspaceMembers.includes(userId)) {
                                try {
                                    cardAssigneeStmt.run(newCardId, userId, now);
                                } catch (e) {
                                    // Ignore duplicate errors
                                }
                            } else {
                                warnings.push(`Card "${card.title}": assignee not in workspace, skipped`);
                            }
                        }
                    }

                    // Import comments
                    if (card.comments && Array.isArray(card.comments)) {
                        for (const comment of card.comments) {
                            const commentUserId = workspaceMembers.includes(comment.user_id) ? comment.user_id : req.user.id;
                            commentStmt.run(
                                generateId(),
                                newCardId,
                                commentUserId,
                                comment.content || '',
                                comment.is_edited ? 1 : 0,
                                now,
                                now
                            );
                            commentsImported++;
                        }
                    }

                    // Import checklists
                    if (card.checklists && Array.isArray(card.checklists)) {
                        for (const checklist of card.checklists) {
                            const newChecklistId = generateId();
                            checklistIdMap.set(checklist.id, newChecklistId);

                            checklistStmt.run(
                                newChecklistId,
                                newCardId,
                                checklist.title || 'Checklist',
                                checklist.position || 0,
                                now
                            );
                            checklistsImported++;

                            if (checklist.items && Array.isArray(checklist.items)) {
                                for (const item of checklist.items) {
                                    const completedBy = item.completed_by && workspaceMembers.includes(item.completed_by)
                                        ? item.completed_by
                                        : null;

                                    checklistItemStmt.run(
                                        generateId(),
                                        newChecklistId,
                                        item.content || item.text || '',
                                        item.is_completed || item.completed ? 1 : 0,
                                        item.position || 0,
                                        item.completed_at || null,
                                        completedBy,
                                        now
                                    );
                                    checklistItemsImported++;
                                }
                            }
                        }
                    }

                    // Add warning for attachments
                    if (card.attachments && card.attachments.length > 0) {
                        warnings.push(`Card "${card.title}": ${card.attachments.length} attachment(s) need to be re-uploaded`);
                    }
                }
            }
        }

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, 'board_imported', ?, ?)
        `).run(
            generateId(),
            req.user.id,
            targetBoardId,
            JSON.stringify({
                mode,
                originalBoardId: importBoard.id,
                originalBoardName: importBoard.name,
                listsImported,
                cardsImported,
                commentsImported,
                checklistsImported
            }),
            now
        );

        // Get the imported/updated board
        const resultBoard = db.prepare('SELECT * FROM boards WHERE id = ?').get(targetBoardId);

        res.json(apiResponse(true, {
            board: resultBoard,
            stats: {
                listsImported,
                cardsImported,
                commentsImported,
                checklistsImported,
                checklistItemsImported,
                labelsImported: labelIdMap.size
            },
            warnings: warnings.length > 0 ? warnings.slice(0, 20) : [] // Limit warnings to prevent huge responses
        }, `Board ${mode === 'merge' ? 'merged' : 'imported'} successfully`));

    } catch (error) {
        console.error('Import board error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to import board: ' + error.message));
    }
}

/**
 * Preview import data without actually importing
 * Returns statistics about what would be imported
 */
export function previewImport(req, res) {
    try {
        const importData = req.body;

        // Validate import data structure
        if (!importData || !importData.version || !importData.board) {
            return res.status(400).json(apiResponse(false, null, 'Invalid import file format'));
        }

        // Check version compatibility
        const supportedVersions = ['1.0'];
        if (!supportedVersions.includes(importData.version)) {
            return res.status(400).json(apiResponse(false, null, `Unsupported export version: ${importData.version}`));
        }

        const board = importData.board;

        // Calculate statistics
        let cardCount = 0;
        let commentCount = 0;
        let checklistCount = 0;
        let checklistItemCount = 0;
        let attachmentCount = 0;
        const uniqueUsers = new Set();

        if (board.lists && Array.isArray(board.lists)) {
            for (const list of board.lists) {
                if (list.cards && Array.isArray(list.cards)) {
                    cardCount += list.cards.length;

                    for (const card of list.cards) {
                        if (card.created_by) uniqueUsers.add(card.created_by);
                        if (card.assignees) card.assignees.forEach(u => uniqueUsers.add(u));

                        if (card.comments) {
                            commentCount += card.comments.length;
                            card.comments.forEach(c => { if (c.user_id) uniqueUsers.add(c.user_id); });
                        }

                        if (card.checklists) {
                            checklistCount += card.checklists.length;
                            card.checklists.forEach(cl => {
                                if (cl.items) checklistItemCount += cl.items.length;
                            });
                        }

                        if (card.attachments) {
                            attachmentCount += card.attachments.length;
                        }
                    }
                }
            }
        }

        res.json(apiResponse(true, {
            version: importData.version,
            exportedAt: importData.exported_at,
            board: {
                name: board.name,
                description: board.description,
                theme: board.background_theme
            },
            stats: {
                lists: board.lists?.length || 0,
                cards: cardCount,
                labels: board.labels?.length || 0,
                comments: commentCount,
                checklists: checklistCount,
                checklistItems: checklistItemCount,
                attachments: attachmentCount,
                uniqueUsers: uniqueUsers.size
            },
            warnings: attachmentCount > 0
                ? [`${attachmentCount} attachment(s) will need to be re-uploaded after import`]
                : []
        }));

    } catch (error) {
        console.error('Preview import error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to preview import: ' + error.message));
    }
}

export default {
    getBoards,
    getBoard,
    createBoard,
    updateBoard,
    deleteBoard,
    exportBoard,
    importBoard,
    previewImport
};
