import Database from 'better-sqlite3';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/wayfinder.db');

let db = null;

export function getDatabase() {
    if (!db) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

export function runMigrations() {
    const database = getDatabase();
    const migrationsPath = join(__dirname, 'migrations');

    if (!existsSync(migrationsPath)) {
        console.log('No migrations folder found, skipping migrations');
        return;
    }

    // Create migrations tracking table if it doesn't exist
    database.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const migrationFiles = readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of migrationFiles) {
        // Check if migration was already applied
        const applied = database.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);
        if (applied) {
            continue;
        }

        console.log(`Running migration: ${file}`);
        const migrationPath = join(migrationsPath, file);
        const migration = readFileSync(migrationPath, 'utf-8');

        try {
            database.exec(migration);
            database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            console.log(`Migration ${file} applied successfully`);
        } catch (error) {
            // Ignore errors for columns that already exist
            if (error.message.includes('duplicate column name')) {
                console.log(`Migration ${file} skipped - columns already exist`);
                database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
            } else {
                console.error(`Migration ${file} failed:`, error.message);
            }
        }
    }
}

export function initializeDatabase() {
    const database = getDatabase();
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    database.exec(schema);
    console.log('Database initialized successfully');

    // Run any pending migrations
    runMigrations();

    return database;
}

export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

export default {
    getDatabase,
    initializeDatabase,
    closeDatabase
};
