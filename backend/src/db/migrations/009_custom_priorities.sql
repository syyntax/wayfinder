-- Migration: Custom per-board priorities
-- Removes the strict CHECK constraint from cards.priority and adds a board_priorities table
-- so each board can define its own set of priority labels and colors.

-- Disable foreign key enforcement while we recreate the cards table so the
-- existing card_labels / card_assignees / comments / attachments / checklists /
-- activity_log rows that reference cards remain valid through the rebuild.
PRAGMA foreign_keys = OFF;

-- 1. Remove CHECK constraint from cards.priority by recreating the table.
--    SQLite cannot ALTER an existing CHECK constraint, so we copy data into a new table.
CREATE TABLE IF NOT EXISTS cards_new (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    due_date DATETIME,
    priority TEXT DEFAULT 'none',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'in_review', 'complete')),
    is_archived BOOLEAN DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO cards_new (id, list_id, title, description, cover_image, position, due_date,
                       priority, status, is_archived, created_by, created_at, updated_at)
SELECT id, list_id, title, description, cover_image, position, due_date,
       priority, status, is_archived, created_by, created_at, updated_at
FROM cards;

DROP TABLE cards;
ALTER TABLE cards_new RENAME TO cards;

-- Recreate indexes that existed on the cards table
CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
CREATE INDEX IF NOT EXISTS idx_cards_list_id ON cards(list_id);
CREATE INDEX IF NOT EXISTS idx_cards_position ON cards(list_id, position);

-- 2. Per-board priority configuration table
CREATE TABLE IF NOT EXISTS board_priorities (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#8b5cf6',
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    UNIQUE(board_id, value)
);

CREATE INDEX IF NOT EXISTS idx_board_priorities_board ON board_priorities(board_id);

-- 3. Seed default priorities for any existing boards so cards continue to render correctly.
--    Uses a deterministic id pattern to avoid collisions if migration is re-run.
INSERT OR IGNORE INTO board_priorities (id, board_id, value, label, color, position)
SELECT b.id || '-prio-none', b.id, 'none', 'None', 'transparent', 0 FROM boards b;

INSERT OR IGNORE INTO board_priorities (id, board_id, value, label, color, position)
SELECT b.id || '-prio-low', b.id, 'low', 'Low', '#06b6d4', 1 FROM boards b;

INSERT OR IGNORE INTO board_priorities (id, board_id, value, label, color, position)
SELECT b.id || '-prio-medium', b.id, 'medium', 'Medium', '#8b5cf6', 2 FROM boards b;

INSERT OR IGNORE INTO board_priorities (id, board_id, value, label, color, position)
SELECT b.id || '-prio-high', b.id, 'high', 'High', '#f97316', 3 FROM boards b;

INSERT OR IGNORE INTO board_priorities (id, board_id, value, label, color, position)
SELECT b.id || '-prio-critical', b.id, 'critical', 'Critical', '#dc2626', 4 FROM boards b;

-- Re-enable foreign key enforcement now that the cards table rebuild is complete.
PRAGMA foreign_keys = ON;
