-- Migration: Add user_mentioned notification type
-- SQLite does not support ALTER TABLE ... MODIFY CHECK, so recreate the table.

CREATE TABLE IF NOT EXISTS notifications_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'comment_added',
        'priority_changed',
        'label_added',
        'label_removed',
        'workspace_added',
        'workspace_removed',
        'user_mentioned'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('card', 'workspace')),
    entity_id TEXT NOT NULL,
    entity_name TEXT,
    actor_id TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO notifications_new SELECT * FROM notifications;

DROP TABLE notifications;

ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
