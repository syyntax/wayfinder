import { initializeDatabase } from './database.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('Initializing Wayfinder database...');
initializeDatabase();
console.log('Database initialization complete.');
