import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique identifier
 */
export function generateId() {
    return uuidv4();
}

/**
 * Sanitize user object to remove sensitive fields
 */
export function sanitizeUser(user) {
    if (!user) return null;
    const { password_hash, ...safeUser } = user;
    return safeUser;
}

/**
 * Parse JSON safely
 */
export function safeJsonParse(str, defaultValue = null) {
    try {
        return JSON.parse(str);
    } catch {
        return defaultValue;
    }
}

/**
 * Format date for SQLite
 */
export function formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString();
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

/**
 * Create a standardized API response
 */
export function apiResponse(success, data = null, message = null, errors = null) {
    const response = { success };
    if (data !== null) response.data = data;
    if (message !== null) response.message = message;
    if (errors !== null) response.errors = errors;
    return response;
}

export default {
    generateId,
    sanitizeUser,
    safeJsonParse,
    formatDate,
    isValidUUID,
    apiResponse
};
