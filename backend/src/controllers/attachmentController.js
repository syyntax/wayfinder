import { getDatabase } from '../db/database.js';
import { generateId, apiResponse } from '../utils/helpers.js';
import { isImageFile, UPLOAD_DIRS } from '../middleware/upload.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Upload attachments to a card
 */
export function uploadAttachments(req, res) {
    try {
        const { cardId } = req.params;
        const db = getDatabase();

        // Check card exists and user has access
        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id
            FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(cardId);

        if (!card) {
            // Clean up uploaded files
            if (req.files) {
                req.files.forEach(file => {
                    try {
                        unlinkSync(file.path);
                    } catch (e) {
                        console.error('Failed to clean up file:', e);
                    }
                });
            }
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        // Check workspace access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            // Clean up uploaded files
            if (req.files) {
                req.files.forEach(file => {
                    try {
                        unlinkSync(file.path);
                    } catch (e) {
                        console.error('Failed to clean up file:', e);
                    }
                });
            }
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json(apiResponse(false, null, 'No files uploaded'));
        }

        const now = new Date().toISOString();
        const attachments = [];
        let firstImageAttachment = null;

        // Check if card already has attachments (for auto-cover logic)
        const existingAttachmentCount = db.prepare(
            'SELECT COUNT(*) as count FROM attachments WHERE card_id = ?'
        ).get(cardId).count;

        // Check if card already has a cover image
        const hasCoverImage = card.cover_image !== null && card.cover_image !== '';

        const insertStmt = db.prepare(`
            INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, uploaded_by, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const file of req.files) {
            const attachmentId = generateId();
            insertStmt.run(
                attachmentId,
                cardId,
                file.originalname,
                file.filename,
                file.size,
                file.mimetype,
                req.user.id,
                now
            );

            const attachment = {
                id: attachmentId,
                card_id: cardId,
                filename: file.originalname,
                stored_filename: file.filename,
                file_size: file.size,
                mime_type: file.mimetype,
                uploaded_by: req.user.id,
                uploaded_at: now
            };

            attachments.push(attachment);

            // Track first image for potential auto-cover
            if (!firstImageAttachment && isImageFile(file.mimetype)) {
                firstImageAttachment = attachment;
            }
        }

        // Auto-set cover image if: no existing cover, no existing attachments, and first uploaded file is an image
        let coverImageSet = false;
        if (!hasCoverImage && existingAttachmentCount === 0 && firstImageAttachment) {
            const coverPath = `/api/uploads/attachments/${firstImageAttachment.stored_filename}`;
            db.prepare('UPDATE cards SET cover_image = ?, updated_at = ? WHERE id = ?')
                .run(coverPath, now, cardId);
            coverImageSet = true;
        }

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, ?, 'attachment_added', ?, ?)
        `).run(
            generateId(),
            req.user.id,
            card.board_id,
            cardId,
            JSON.stringify({ count: attachments.length, files: attachments.map(a => a.filename) }),
            now
        );

        res.status(201).json(apiResponse(true, {
            attachments,
            coverImageSet,
            coverImage: coverImageSet ? `/api/uploads/attachments/${firstImageAttachment.stored_filename}` : null
        }, 'Files uploaded successfully'));

    } catch (error) {
        console.error('Upload attachments error:', error);
        // Clean up any uploaded files on error
        if (req.files) {
            req.files.forEach(file => {
                try {
                    unlinkSync(file.path);
                } catch (e) {
                    console.error('Failed to clean up file:', e);
                }
            });
        }
        res.status(500).json(apiResponse(false, null, 'Failed to upload files'));
    }
}

/**
 * Get all attachments for a card
 */
export function getCardAttachments(req, res) {
    try {
        const { cardId } = req.params;
        const db = getDatabase();

        // Check card exists and user has access
        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id
            FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(cardId);

        if (!card) {
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        // Check workspace access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        const attachments = db.prepare(`
            SELECT a.*, u.username, u.display_name, u.avatar_url
            FROM attachments a
            JOIN users u ON a.uploaded_by = u.id
            WHERE a.card_id = ?
            ORDER BY a.uploaded_at DESC
        `).all(cardId);

        res.json(apiResponse(true, { attachments }));

    } catch (error) {
        console.error('Get attachments error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to get attachments'));
    }
}

/**
 * Delete an attachment
 */
export function deleteAttachment(req, res) {
    try {
        const { attachmentId } = req.params;
        const db = getDatabase();

        // Get attachment with card and access info
        const attachment = db.prepare(`
            SELECT a.*, c.cover_image, l.board_id, b.workspace_id
            FROM attachments a
            JOIN cards c ON a.card_id = c.id
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE a.id = ?
        `).get(attachmentId);

        if (!attachment) {
            return res.status(404).json(apiResponse(false, null, 'Attachment not found'));
        }

        // Check workspace access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(attachment.workspace_id, req.user.id);

        if (!hasAccess) {
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        // Delete file from disk
        const filePath = join(UPLOAD_DIRS.attachments, attachment.stored_filename);
        if (existsSync(filePath)) {
            try {
                unlinkSync(filePath);
            } catch (e) {
                console.error('Failed to delete file:', e);
            }
        }

        // Check if this attachment was the cover image
        const attachmentUrl = `/api/uploads/attachments/${attachment.stored_filename}`;
        const wasCoverImage = attachment.cover_image === attachmentUrl;

        // Delete from database
        db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);

        // If this was the cover image, clear it
        if (wasCoverImage) {
            db.prepare('UPDATE cards SET cover_image = NULL, updated_at = ? WHERE id = ?')
                .run(new Date().toISOString(), attachment.card_id);
        }

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, ?, 'attachment_deleted', ?, ?)
        `).run(
            generateId(),
            req.user.id,
            attachment.board_id,
            attachment.card_id,
            JSON.stringify({ filename: attachment.filename }),
            new Date().toISOString()
        );

        res.json(apiResponse(true, { coverImageCleared: wasCoverImage }, 'Attachment deleted'));

    } catch (error) {
        console.error('Delete attachment error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to delete attachment'));
    }
}

/**
 * Upload cover image for a card
 */
export function uploadCardCover(req, res) {
    try {
        const { cardId } = req.params;
        const db = getDatabase();

        // Check card exists and user has access
        const card = db.prepare(`
            SELECT c.*, l.board_id, b.workspace_id
            FROM cards c
            JOIN lists l ON c.list_id = l.id
            JOIN boards b ON l.board_id = b.id
            WHERE c.id = ?
        `).get(cardId);

        if (!card) {
            // Clean up uploaded file
            if (req.file) {
                try {
                    unlinkSync(req.file.path);
                } catch (e) {
                    console.error('Failed to clean up file:', e);
                }
            }
            return res.status(404).json(apiResponse(false, null, 'Card not found'));
        }

        // Check workspace access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(card.workspace_id, req.user.id);

        if (!hasAccess) {
            // Clean up uploaded file
            if (req.file) {
                try {
                    unlinkSync(req.file.path);
                } catch (e) {
                    console.error('Failed to clean up file:', e);
                }
            }
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        if (!req.file) {
            return res.status(400).json(apiResponse(false, null, 'No file uploaded'));
        }

        // Delete old cover image if it's a local file
        if (card.cover_image && card.cover_image.startsWith('/api/uploads/covers/')) {
            const oldFilename = card.cover_image.replace('/api/uploads/covers/', '');
            const oldPath = join(UPLOAD_DIRS.covers, oldFilename);
            if (existsSync(oldPath)) {
                try {
                    unlinkSync(oldPath);
                } catch (e) {
                    console.error('Failed to delete old cover:', e);
                }
            }
        }

        const coverPath = `/api/uploads/covers/${req.file.filename}`;
        const now = new Date().toISOString();

        db.prepare('UPDATE cards SET cover_image = ?, updated_at = ? WHERE id = ?')
            .run(coverPath, now, cardId);

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, card_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, ?, 'cover_updated', ?, ?)
        `).run(
            generateId(),
            req.user.id,
            card.board_id,
            cardId,
            JSON.stringify({ type: 'upload', filename: req.file.originalname }),
            now
        );

        res.json(apiResponse(true, { coverImage: coverPath }, 'Cover image updated'));

    } catch (error) {
        console.error('Upload card cover error:', error);
        // Clean up uploaded file on error
        if (req.file) {
            try {
                unlinkSync(req.file.path);
            } catch (e) {
                console.error('Failed to clean up file:', e);
            }
        }
        res.status(500).json(apiResponse(false, null, 'Failed to upload cover image'));
    }
}

/**
 * Upload cover image for a board
 */
export function uploadBoardCover(req, res) {
    try {
        const { boardId } = req.params;
        const db = getDatabase();

        // Check board exists and user has access
        const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);

        if (!board) {
            // Clean up uploaded file
            if (req.file) {
                try {
                    unlinkSync(req.file.path);
                } catch (e) {
                    console.error('Failed to clean up file:', e);
                }
            }
            return res.status(404).json(apiResponse(false, null, 'Board not found'));
        }

        // Check workspace access
        const hasAccess = db.prepare(`
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
        `).get(board.workspace_id, req.user.id);

        if (!hasAccess) {
            // Clean up uploaded file
            if (req.file) {
                try {
                    unlinkSync(req.file.path);
                } catch (e) {
                    console.error('Failed to clean up file:', e);
                }
            }
            return res.status(403).json(apiResponse(false, null, 'Access denied'));
        }

        if (!req.file) {
            return res.status(400).json(apiResponse(false, null, 'No file uploaded'));
        }

        // Delete old cover image if it's a local file
        if (board.cover_image && board.cover_image.startsWith('/api/uploads/covers/')) {
            const oldFilename = board.cover_image.replace('/api/uploads/covers/', '');
            const oldPath = join(UPLOAD_DIRS.covers, oldFilename);
            if (existsSync(oldPath)) {
                try {
                    unlinkSync(oldPath);
                } catch (e) {
                    console.error('Failed to delete old cover:', e);
                }
            }
        }

        const coverPath = `/api/uploads/covers/${req.file.filename}`;
        const now = new Date().toISOString();

        db.prepare('UPDATE boards SET cover_image = ?, updated_at = ? WHERE id = ?')
            .run(coverPath, now, boardId);

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (id, user_id, board_id, action_type, action_data, created_at)
            VALUES (?, ?, ?, 'board_cover_updated', ?, ?)
        `).run(
            generateId(),
            req.user.id,
            boardId,
            JSON.stringify({ type: 'upload', filename: req.file.originalname }),
            now
        );

        const updatedBoard = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);

        res.json(apiResponse(true, { board: updatedBoard, coverImage: coverPath }, 'Cover image updated'));

    } catch (error) {
        console.error('Upload board cover error:', error);
        // Clean up uploaded file on error
        if (req.file) {
            try {
                unlinkSync(req.file.path);
            } catch (e) {
                console.error('Failed to clean up file:', e);
            }
        }
        res.status(500).json(apiResponse(false, null, 'Failed to upload cover image'));
    }
}

export default {
    uploadAttachments,
    getCardAttachments,
    deleteAttachment,
    uploadCardCover,
    uploadBoardCover
};
