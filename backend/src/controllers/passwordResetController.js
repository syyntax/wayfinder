import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../db/database.js';
import { apiResponse } from '../utils/helpers.js';
import { sendPasswordResetEmail } from '../services/mailService.js';

// Token expiration time: 1 hour in milliseconds
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * Request a password reset
 * Generates a secure token, stores it, and sends reset email
 * IMPORTANT: Always returns success to prevent email enumeration attacks
 */
export async function requestPasswordReset(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json(apiResponse(false, null, 'Email is required'));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json(apiResponse(false, null, 'Invalid email format'));
        }

        const db = getDatabase();

        // Find user by email (case-insensitive)
        const user = db.prepare('SELECT id, email, display_name FROM users WHERE LOWER(email) = LOWER(?)').get(email);

        // Always return success message to prevent email enumeration
        const successMessage = 'If an account exists with that email, a password reset link has been sent.';

        if (!user) {
            // Return success even if user doesn't exist (security best practice)
            return res.json(apiResponse(true, null, successMessage));
        }

        // Generate cryptographically secure token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Calculate expiration time (1 hour from now)
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS).toISOString();

        // Store token and expiration in database
        db.prepare(`
            UPDATE users
            SET password_reset_token = ?, password_reset_expires = ?, updated_at = ?
            WHERE id = ?
        `).run(resetToken, expiresAt, new Date().toISOString(), user.id);

        // Send password reset email
        try {
            await sendPasswordResetEmail(user.email, resetToken, user.display_name);
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);

            // Check if mail server is not configured
            if (emailError.message === 'Mail server not configured') {
                return res.status(503).json(apiResponse(
                    false,
                    null,
                    'Password reset is not available. Please contact support.'
                ));
            }

            // For other email errors, still return success to prevent enumeration
            // but log the error for debugging
            console.error('Email sending failed for password reset:', emailError.message);
        }

        res.json(apiResponse(true, null, successMessage));

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to process password reset request'));
    }
}

/**
 * Verify a password reset token
 * Checks if the token exists and hasn't expired
 */
export function verifyResetToken(req, res) {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json(apiResponse(false, null, 'Token is required'));
        }

        const db = getDatabase();

        // Find user with this token
        const user = db.prepare(`
            SELECT id, password_reset_expires
            FROM users
            WHERE password_reset_token = ?
        `).get(token);

        if (!user) {
            return res.status(400).json(apiResponse(
                false,
                null,
                'This password reset link is invalid or has expired. Please request a new one.'
            ));
        }

        // Check if token has expired
        const expiresAt = new Date(user.password_reset_expires);
        if (expiresAt < new Date()) {
            // Clear expired token
            db.prepare(`
                UPDATE users
                SET password_reset_token = NULL, password_reset_expires = NULL
                WHERE id = ?
            `).run(user.id);

            return res.status(400).json(apiResponse(
                false,
                null,
                'This password reset link has expired. Please request a new one.'
            ));
        }

        // Token is valid
        res.json(apiResponse(true, { valid: true }, 'Token is valid'));

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to verify token'));
    }
}

/**
 * Reset password using a valid token
 * Validates token, hashes new password, updates user, clears token
 */
export async function resetPassword(req, res) {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token) {
            return res.status(400).json(apiResponse(false, null, 'Token is required'));
        }

        if (!password) {
            return res.status(400).json(apiResponse(false, null, 'New password is required'));
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json(apiResponse(
                false,
                null,
                'Password must be at least 8 characters long'
            ));
        }

        // Check for uppercase, lowercase, and number
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json(apiResponse(
                false,
                null,
                'Password must contain at least one uppercase letter, one lowercase letter, and one number'
            ));
        }

        const db = getDatabase();

        // Find user with this token
        const user = db.prepare(`
            SELECT id, password_reset_expires
            FROM users
            WHERE password_reset_token = ?
        `).get(token);

        if (!user) {
            return res.status(400).json(apiResponse(
                false,
                null,
                'This password reset link is invalid or has expired. Please request a new one.'
            ));
        }

        // Check if token has expired
        const expiresAt = new Date(user.password_reset_expires);
        if (expiresAt < new Date()) {
            // Clear expired token
            db.prepare(`
                UPDATE users
                SET password_reset_token = NULL, password_reset_expires = NULL
                WHERE id = ?
            `).run(user.id);

            return res.status(400).json(apiResponse(
                false,
                null,
                'This password reset link has expired. Please request a new one.'
            ));
        }

        // Hash the new password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Update password and clear reset token (single-use token)
        db.prepare(`
            UPDATE users
            SET password_hash = ?,
                password_reset_token = NULL,
                password_reset_expires = NULL,
                updated_at = ?
            WHERE id = ?
        `).run(passwordHash, new Date().toISOString(), user.id);

        res.json(apiResponse(true, null, 'Password has been reset successfully. You can now log in with your new password.'));

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to reset password'));
    }
}

export default {
    requestPasswordReset,
    verifyResetToken,
    resetPassword
};
