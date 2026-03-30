import jwt from 'jsonwebtoken';
import { getDatabase } from '../db/database.js';
import { apiResponse, sanitizeUser } from '../utils/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'wayfinder-dev-secret-change-in-production';

/**
 * Authenticate JWT token middleware
 */
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json(apiResponse(false, null, 'Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = getDatabase();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);

        if (!user) {
            return res.status(401).json(apiResponse(false, null, 'User not found'));
        }

        req.user = sanitizeUser(user);
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json(apiResponse(false, null, 'Token expired'));
        }
        return res.status(403).json(apiResponse(false, null, 'Invalid token'));
    }
}

/**
 * Optional authentication - attaches user if token present, continues otherwise
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = getDatabase();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
        if (user) {
            req.user = sanitizeUser(user);
        }
    } catch {
        // Token invalid, continue without user
    }

    next();
}

/**
 * Require specific roles middleware
 */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json(apiResponse(false, null, 'Authentication required'));
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json(apiResponse(false, null, 'Insufficient permissions'));
        }

        next();
    };
}

/**
 * Require Super Admin role
 */
export function requireSuperAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json(apiResponse(false, null, 'Authentication required'));
    }

    if (req.user.role !== 'super_admin') {
        return res.status(403).json(apiResponse(false, null, 'Super Admin access required'));
    }

    next();
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId) {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
}

export default {
    authenticateToken,
    optionalAuth,
    requireRole,
    requireSuperAdmin,
    generateToken
};
