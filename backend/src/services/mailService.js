import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { getDatabase } from '../db/database.js';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment or generate a warning
 */
function getEncryptionKey() {
    const key = process.env.MAIL_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!key) {
        console.warn('WARNING: No MAIL_ENCRYPTION_KEY set, using fallback. Set MAIL_ENCRYPTION_KEY in production!');
        return 'wayfinder-mail-encryption-key-change-in-production';
    }
    return key;
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encryptPassword(plaintext) {
    if (!plaintext) return null;

    const key = getEncryptionKey();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from password using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha256');

    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine salt + iv + tag + encrypted data
    const combined = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);

    return combined.toString('base64');
}

/**
 * Decrypt a string using AES-256-GCM
 */
export function decryptPassword(encryptedData) {
    if (!encryptedData) return null;

    try {
        const key = getEncryptionKey();
        const combined = Buffer.from(encryptedData, 'base64');

        // Extract components
        const salt = combined.subarray(0, SALT_LENGTH);
        const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

        // Derive key from password using PBKDF2
        const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha256');

        const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Failed to decrypt password:', error.message);
        return null;
    }
}

/**
 * Get mail settings from database
 */
export function getMailSettings() {
    const db = getDatabase();
    const settings = db.prepare('SELECT * FROM mail_settings WHERE id = 1').get();
    return settings || null;
}

/**
 * Get mail settings with decrypted password (for internal use only)
 */
export function getMailSettingsWithPassword() {
    const settings = getMailSettings();
    if (!settings) return null;

    return {
        ...settings,
        smtp_password: settings.smtp_password_encrypted
            ? decryptPassword(settings.smtp_password_encrypted)
            : null
    };
}

/**
 * Get mail settings for API response (password masked)
 */
export function getMailSettingsForApi() {
    const settings = getMailSettings();
    if (!settings) return null;

    return {
        mail_provider: settings.mail_provider || 'smtp',
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_secure: Boolean(settings.smtp_secure),
        smtp_username: settings.smtp_username,
        smtp_password: settings.smtp_password_encrypted ? '********' : null,
        from_email: settings.from_email,
        from_name: settings.from_name,
        sendgrid_from_email: settings.sendgrid_from_email,
        sendgrid_from_name: settings.sendgrid_from_name,
        sendgrid_api_key_configured: Boolean(process.env.SENDGRID_WEB_API_KEY)
    };
}

/**
 * Update mail settings in database
 */
export function updateMailSettings(data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const updates = [];
    const values = [];

    if (data.mail_provider !== undefined) {
        updates.push('mail_provider = ?');
        values.push(data.mail_provider || 'smtp');
    }

    if (data.smtp_host !== undefined) {
        updates.push('smtp_host = ?');
        values.push(data.smtp_host || null);
    }

    if (data.smtp_port !== undefined) {
        updates.push('smtp_port = ?');
        values.push(parseInt(data.smtp_port) || 587);
    }

    if (data.smtp_secure !== undefined) {
        updates.push('smtp_secure = ?');
        values.push(data.smtp_secure ? 1 : 0);
    }

    if (data.smtp_username !== undefined) {
        updates.push('smtp_username = ?');
        values.push(data.smtp_username || null);
    }

    // Only update password if a new one is provided (not the masked value)
    if (data.smtp_password !== undefined && data.smtp_password !== '********') {
        updates.push('smtp_password_encrypted = ?');
        values.push(data.smtp_password ? encryptPassword(data.smtp_password) : null);
    }

    if (data.from_email !== undefined) {
        updates.push('from_email = ?');
        values.push(data.from_email || null);
    }

    if (data.from_name !== undefined) {
        updates.push('from_name = ?');
        values.push(data.from_name || 'Wayfinder');
    }

    if (data.sendgrid_from_email !== undefined) {
        updates.push('sendgrid_from_email = ?');
        values.push(data.sendgrid_from_email || null);
    }

    if (data.sendgrid_from_name !== undefined) {
        updates.push('sendgrid_from_name = ?');
        values.push(data.sendgrid_from_name || 'Wayfinder');
    }

    if (updates.length === 0) {
        return getMailSettingsForApi();
    }

    updates.push('updated_at = ?');
    values.push(now);

    db.prepare(`UPDATE mail_settings SET ${updates.join(', ')} WHERE id = 1`).run(...values);

    return getMailSettingsForApi();
}

/**
 * Create nodemailer transporter from stored settings
 */
export function createTransporter() {
    const settings = getMailSettingsWithPassword();

    if (!settings || !settings.smtp_host) {
        throw new Error('Mail server not configured');
    }

    const transportConfig = {
        host: settings.smtp_host,
        port: settings.smtp_port || 587,
        secure: Boolean(settings.smtp_secure),
    };

    // Add authentication if credentials provided
    if (settings.smtp_username && settings.smtp_password) {
        transportConfig.auth = {
            user: settings.smtp_username,
            pass: settings.smtp_password
        };
    }

    return nodemailer.createTransport(transportConfig);
}

/**
 * Check if SendGrid is properly configured
 */
export function isSendGridConfigured() {
    return Boolean(process.env.SENDGRID_WEB_API_KEY);
}

/**
 * Check if SMTP is properly configured
 */
export function isSmtpConfigured() {
    const settings = getMailSettings();
    return Boolean(settings && settings.smtp_host);
}

/**
 * Check if any mail provider is configured
 */
export function isMailConfigured() {
    const settings = getMailSettings();
    if (!settings) return false;

    const provider = settings.mail_provider || 'smtp';

    if (provider === 'sendgrid') {
        return isSendGridConfigured() && Boolean(settings.sendgrid_from_email);
    } else {
        return isSmtpConfigured();
    }
}

/**
 * Send an email using SendGrid Web API
 */
async function sendEmailViaSendGrid(to, subject, html, text = null) {
    const apiKey = process.env.SENDGRID_WEB_API_KEY;

    if (!apiKey) {
        throw new Error('SendGrid API key not configured. Set SENDGRID_WEB_API_KEY environment variable.');
    }

    const settings = getMailSettings();

    if (!settings || !settings.sendgrid_from_email) {
        throw new Error('SendGrid sender email not configured. Please configure it in Mail Settings.');
    }

    sgMail.setApiKey(apiKey);

    const msg = {
        to,
        from: {
            email: settings.sendgrid_from_email,
            name: settings.sendgrid_from_name || 'Wayfinder'
        },
        subject,
        text: text || html.replace(/<[^>]*>/g, ''),
        html
    };

    try {
        const response = await sgMail.send(msg);
        return {
            success: true,
            messageId: response[0]?.headers?.['x-message-id'] || 'sendgrid-' + Date.now(),
            response: 'Email sent via SendGrid'
        };
    } catch (error) {
        console.error('SendGrid error:', error);

        // Extract meaningful error message
        let errorMessage = 'Failed to send email via SendGrid';
        if (error.response?.body?.errors) {
            errorMessage = error.response.body.errors.map(e => e.message).join(', ');
        } else if (error.message) {
            errorMessage = error.message;
        }

        // Don't expose API key in error messages
        if (errorMessage.includes(apiKey)) {
            errorMessage = 'SendGrid API error. Please check your API key configuration.';
        }

        throw new Error(errorMessage);
    }
}

/**
 * Send an email using SMTP (nodemailer)
 */
async function sendEmailViaSMTP(to, subject, html, text = null) {
    const settings = getMailSettingsWithPassword();

    if (!settings || !settings.smtp_host) {
        throw new Error('SMTP server not configured');
    }

    const transporter = createTransporter();

    const mailOptions = {
        from: settings.from_email
            ? `"${settings.from_name || 'Wayfinder'}" <${settings.from_email}>`
            : undefined,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for plain text fallback
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        return {
            success: true,
            messageId: info.messageId,
            response: info.response
        };
    } catch (error) {
        console.error('Failed to send email via SMTP:', error);
        throw error;
    }
}

/**
 * Send an email using the configured provider (SMTP or SendGrid)
 */
export async function sendEmail(to, subject, html, text = null) {
    const settings = getMailSettings();
    const provider = settings?.mail_provider || 'smtp';

    if (provider === 'sendgrid') {
        return sendEmailViaSendGrid(to, subject, html, text);
    } else {
        return sendEmailViaSMTP(to, subject, html, text);
    }
}

/**
 * Test SendGrid connection by verifying the API key
 */
export async function testSendGridConnection() {
    const apiKey = process.env.SENDGRID_WEB_API_KEY;

    if (!apiKey) {
        throw new Error('SendGrid API key not configured. Set SENDGRID_WEB_API_KEY environment variable.');
    }

    const settings = getMailSettings();

    if (!settings || !settings.sendgrid_from_email) {
        throw new Error('SendGrid sender email not configured. Please save settings first.');
    }

    // SendGrid doesn't have a simple "verify" endpoint, so we'll do a basic check
    // The real test happens when sending a test email
    return {
        success: true,
        message: 'SendGrid API key is configured. Send a test email to verify it works.'
    };
}

/**
 * Send a test email to verify mail configuration
 */
export async function sendTestEmail(testEmail) {
    const settings = getMailSettings();
    const provider = settings?.mail_provider || 'smtp';

    if (provider === 'sendgrid') {
        if (!process.env.SENDGRID_WEB_API_KEY) {
            throw new Error('SendGrid API key not configured. Set SENDGRID_WEB_API_KEY environment variable.');
        }
        if (!settings.sendgrid_from_email) {
            throw new Error('SendGrid sender email not configured. Please save settings first.');
        }
    } else {
        if (!settings || !settings.smtp_host) {
            throw new Error('Mail server not configured. Please save settings first.');
        }
    }

    if (!testEmail) {
        throw new Error('Test email address is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
        throw new Error('Invalid email address format');
    }

    const fromEmail = provider === 'sendgrid' ? settings.sendgrid_from_email : settings.from_email;
    const fromName = provider === 'sendgrid' ? settings.sendgrid_from_name : settings.from_name;
    const providerInfo = provider === 'sendgrid' ? 'SendGrid Web API' : `SMTP (${settings.smtp_host}:${settings.smtp_port})`;

    const subject = 'Wayfinder - Test Email';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Test Email</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border: 1px solid #333; border-radius: 12px 12px 0 0;">
                                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #8b3daf; letter-spacing: 2px; text-transform: uppercase;">
                                        Wayfinder
                                    </h1>
                                    <p style="margin: 10px 0 0 0; color: #888; font-size: 14px;">
                                        Dark Fantasy Cyberpunk Kanban
                                    </p>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px; background-color: #111; border-left: 1px solid #333; border-right: 1px solid #333;">
                                    <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #e0e0e0;">
                                        Test Email Successful
                                    </h2>
                                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #999;">
                                        Congratulations! Your mail server configuration is working correctly.
                                        Wayfinder is now able to send email notifications.
                                    </p>
                                    <div style="padding: 20px; background-color: rgba(139, 61, 175, 0.1); border: 1px solid rgba(139, 61, 175, 0.3); border-radius: 8px;">
                                        <p style="margin: 0; font-size: 14px; color: #8b3daf;">
                                            <strong>Provider:</strong> ${providerInfo}<br>
                                            <strong>From:</strong> ${fromName} &lt;${fromEmail}&gt;
                                        </p>
                                    </div>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 20px 30px; background-color: #0d0d0d; border: 1px solid #333; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                                    <p style="margin: 0; font-size: 12px; color: #666;">
                                        This is an automated test email from Wayfinder.
                                    </p>
                                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #444;">
                                        Sent at: ${new Date().toISOString()}
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    return await sendEmail(testEmail, subject, html);
}

/**
 * Verify SMTP connection without sending email
 */
export async function verifyConnection() {
    const settings = getMailSettings();
    const provider = settings?.mail_provider || 'smtp';

    if (provider === 'sendgrid') {
        return testSendGridConnection();
    }

    const transporter = createTransporter();

    try {
        await transporter.verify();
        return { success: true, message: 'SMTP connection verified successfully' };
    } catch (error) {
        throw new Error(`SMTP connection failed: ${error.message}`);
    }
}

/**
 * Send a welcome email to a new user
 * @param {string} email - Recipient email address
 * @param {string} displayName - User's display name
 */
export async function sendWelcomeEmail(email, displayName = null) {
    // Check if mail is configured before attempting to send
    if (!isMailConfigured()) {
        console.log('Mail not configured - skipping welcome email');
        return null;
    }

    // Get frontend URL from environment or use default
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginLink = `${frontendUrl}/login`;

    const subject = 'Welcome to Wayfinder - Your Command Deck Awaits';
    const userName = displayName || 'Operator';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Wayfinder</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border: 1px solid #333; border-radius: 12px 12px 0 0; text-align: center;">
                                    <div style="display: inline-block; padding: 15px; border: 2px solid #8b3daf; border-radius: 50%; margin-bottom: 15px;">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#8b3daf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M2 17L12 22L22 17" stroke="#8b3daf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M2 12L12 17L22 12" stroke="#8b3daf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #8b3daf; letter-spacing: 2px; text-transform: uppercase;">
                                        WAYFINDER
                                    </h1>
                                    <p style="margin: 10px 0 0 0; color: #06b6d4; font-size: 14px; letter-spacing: 1px; font-weight: 600;">
                                        Welcome Aboard
                                    </p>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px; background-color: #111; border-left: 1px solid #333; border-right: 1px solid #333;">
                                    <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #e0e0e0;">
                                        Greetings, ${userName}!
                                    </h2>
                                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #999;">
                                        Your command deck has been initialized. Welcome to Wayfinder - where dark fantasy meets cyberpunk efficiency in project management.
                                    </p>

                                    <!-- Getting Started Section -->
                                    <div style="padding: 20px; background-color: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 8px; margin-bottom: 20px;">
                                        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #06b6d4; text-transform: uppercase; letter-spacing: 1px;">
                                            // Initialize Your Journey
                                        </h3>
                                        <ul style="margin: 0; padding: 0 0 0 20px; color: #999; font-size: 14px; line-height: 2;">
                                            <li><span style="color: #8b3daf;">Create your first board</span> - Organize your projects in the command center</li>
                                            <li><span style="color: #8b3daf;">Invite your crew</span> - Collaborate with team members in shared workspaces</li>
                                            <li><span style="color: #8b3daf;">Explore the interface</span> - Discover cards, lists, labels, and more</li>
                                        </ul>
                                    </div>

                                    <!-- Login Button -->
                                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                        <tr>
                                            <td align="center">
                                                <a href="${loginLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b3daf 0%, #6b2d8f 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; border-radius: 8px; box-shadow: 0 4px 15px rgba(139, 61, 175, 0.4);">
                                                    Access Command Deck
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                                        If the button doesn't work, copy and paste this link into your browser:
                                    </p>
                                    <p style="margin: 10px 0 0 0; font-size: 12px; line-height: 1.4; color: #06b6d4; word-break: break-all; background-color: #0d0d0d; padding: 12px; border-radius: 6px; border: 1px solid #222;">
                                        ${loginLink}
                                    </p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 25px 30px; background-color: #0d0d0d; border: 1px solid #333; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
                                        This is an automated message from Wayfinder.
                                        Please do not reply to this email.
                                    </p>
                                    <p style="margin: 0; font-size: 11px; color: #444;">
                                        Sent at: ${new Date().toISOString()}
                                    </p>
                                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #222;">
                                        <p style="margin: 0; font-size: 11px; color: #555;">
                                            Dark Fantasy Cyberpunk Kanban
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const text = `
WAYFINDER - Welcome Aboard

Greetings, ${userName}!

Your command deck has been initialized. Welcome to Wayfinder - where dark fantasy meets cyberpunk efficiency in project management.

// INITIALIZE YOUR JOURNEY

- Create your first board - Organize your projects in the command center
- Invite your crew - Collaborate with team members in shared workspaces
- Explore the interface - Discover cards, lists, labels, and more

Login here: ${loginLink}

---
This is an automated message from Wayfinder.
Sent at: ${new Date().toISOString()}
    `.trim();

    try {
        return await sendEmail(email, subject, html, text);
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        // Don't throw - welcome emails shouldn't block registration
        return null;
    }
}

/**
 * Send a password reset email with a secure reset link
 * @param {string} email - Recipient email address
 * @param {string} resetToken - The secure reset token
 * @param {string} displayName - User's display name (optional)
 */
export async function sendPasswordResetEmail(email, resetToken, displayName = null) {
    const settings = getMailSettings();
    const provider = settings?.mail_provider || 'smtp';

    if (provider === 'sendgrid') {
        if (!process.env.SENDGRID_WEB_API_KEY) {
            throw new Error('SendGrid API key not configured');
        }
        if (!settings.sendgrid_from_email) {
            throw new Error('SendGrid sender email not configured');
        }
    } else {
        if (!settings || !settings.smtp_host) {
            throw new Error('Mail server not configured');
        }
    }

    // Get frontend URL from environment or use default
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    const subject = 'Wayfinder - Password Reset Request';
    const userName = displayName || 'Operator';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border: 1px solid #333; border-radius: 12px 12px 0 0; text-align: center;">
                                    <div style="display: inline-block; padding: 15px; border: 2px solid #8b3daf; border-radius: 50%; margin-bottom: 15px;">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 17V11M12 7H12.01M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="#8b3daf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #8b3daf; letter-spacing: 2px; text-transform: uppercase;">
                                        WAYFINDER
                                    </h1>
                                    <p style="margin: 10px 0 0 0; color: #888; font-size: 14px; letter-spacing: 1px;">
                                        Password Reset Request
                                    </p>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px; background-color: #111; border-left: 1px solid #333; border-right: 1px solid #333;">
                                    <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #e0e0e0;">
                                        Hello, ${userName}
                                    </h2>
                                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #999;">
                                        We received a request to reset the password for your Wayfinder account.
                                        Click the button below to create a new password.
                                    </p>

                                    <!-- Reset Button -->
                                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                        <tr>
                                            <td align="center">
                                                <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #8b3daf 0%, #6b2d8f 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; border-radius: 8px; box-shadow: 0 4px 15px rgba(139, 61, 175, 0.4);">
                                                    Reset Password
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Expiration Notice -->
                                    <div style="padding: 20px; background-color: rgba(139, 61, 175, 0.1); border: 1px solid rgba(139, 61, 175, 0.3); border-radius: 8px; margin-bottom: 20px;">
                                        <p style="margin: 0; font-size: 14px; color: #c9a0dc;">
                                            <strong style="color: #8b3daf;">Important:</strong> This link will expire in <strong>1 hour</strong>.
                                            After that, you'll need to request a new password reset.
                                        </p>
                                    </div>

                                    <p style="margin: 0 0 15px 0; font-size: 14px; line-height: 1.6; color: #666;">
                                        If the button doesn't work, copy and paste this link into your browser:
                                    </p>
                                    <p style="margin: 0 0 20px 0; font-size: 12px; line-height: 1.4; color: #06b6d4; word-break: break-all; background-color: #0d0d0d; padding: 12px; border-radius: 6px; border: 1px solid #222;">
                                        ${resetLink}
                                    </p>

                                    <!-- Security Notice -->
                                    <div style="padding: 15px; background-color: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px;">
                                        <p style="margin: 0; font-size: 13px; color: #ef4444;">
                                            <strong>Didn't request this?</strong> If you didn't request a password reset,
                                            you can safely ignore this email. Your password will remain unchanged.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 25px 30px; background-color: #0d0d0d; border: 1px solid #333; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
                                        This is an automated message from Wayfinder.
                                        Please do not reply to this email.
                                    </p>
                                    <p style="margin: 0; font-size: 11px; color: #444;">
                                        Sent at: ${new Date().toISOString()}
                                    </p>
                                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #222;">
                                        <p style="margin: 0; font-size: 11px; color: #555;">
                                            Dark Fantasy Cyberpunk Kanban
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const text = `
WAYFINDER - Password Reset Request

Hello, ${userName}

We received a request to reset the password for your Wayfinder account.

To reset your password, visit this link:
${resetLink}

IMPORTANT: This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
Your password will remain unchanged.

---
This is an automated message from Wayfinder.
Sent at: ${new Date().toISOString()}
    `.trim();

    return await sendEmail(email, subject, html, text);
}

/**
 * Send an approval notification email to a user
 * @param {string} email - Recipient email address
 * @param {string} displayName - User's display name
 */
export async function sendApprovalEmail(email, displayName = null) {
    const settings = getMailSettings();
    const provider = settings?.mail_provider || 'smtp';

    if (provider === 'sendgrid') {
        if (!process.env.SENDGRID_WEB_API_KEY) {
            throw new Error('SendGrid API key not configured');
        }
        if (!settings.sendgrid_from_email) {
            throw new Error('SendGrid sender email not configured');
        }
    } else {
        if (!settings || !settings.smtp_host) {
            throw new Error('Mail server not configured');
        }
    }

    // Get frontend URL from environment or use default
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginLink = `${frontendUrl}/login`;

    const subject = 'Wayfinder - Your Account Has Been Approved';
    const userName = displayName || 'Operator';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Approved</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border: 1px solid #333; border-radius: 12px 12px 0 0; text-align: center;">
                                    <div style="display: inline-block; padding: 15px; border: 2px solid #10b981; border-radius: 50%; margin-bottom: 15px;">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #8b3daf; letter-spacing: 2px; text-transform: uppercase;">
                                        WAYFINDER
                                    </h1>
                                    <p style="margin: 10px 0 0 0; color: #10b981; font-size: 14px; letter-spacing: 1px; font-weight: 600;">
                                        Account Approved
                                    </p>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px; background-color: #111; border-left: 1px solid #333; border-right: 1px solid #333;">
                                    <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #e0e0e0;">
                                        Welcome, ${userName}!
                                    </h2>
                                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #999;">
                                        Great news! Your Wayfinder account has been approved by an administrator.
                                        You can now log in and start using the platform.
                                    </p>

                                    <!-- Login Button -->
                                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                        <tr>
                                            <td align="center">
                                                <a href="${loginLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; border-radius: 8px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
                                                    Access Terminal
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    <div style="padding: 20px; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px;">
                                        <p style="margin: 0; font-size: 14px; color: #10b981;">
                                            <strong>What's next?</strong><br>
                                            Log in with your email and password to access your personal workspace
                                            and start organizing your projects.
                                        </p>
                                    </div>

                                    <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                                        If the button doesn't work, copy and paste this link into your browser:
                                    </p>
                                    <p style="margin: 10px 0 0 0; font-size: 12px; line-height: 1.4; color: #06b6d4; word-break: break-all; background-color: #0d0d0d; padding: 12px; border-radius: 6px; border: 1px solid #222;">
                                        ${loginLink}
                                    </p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 25px 30px; background-color: #0d0d0d; border: 1px solid #333; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
                                        This is an automated message from Wayfinder.
                                        Please do not reply to this email.
                                    </p>
                                    <p style="margin: 0; font-size: 11px; color: #444;">
                                        Sent at: ${new Date().toISOString()}
                                    </p>
                                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #222;">
                                        <p style="margin: 0; font-size: 11px; color: #555;">
                                            Dark Fantasy Cyberpunk Kanban
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const text = `
WAYFINDER - Account Approved

Welcome, ${userName}!

Great news! Your Wayfinder account has been approved by an administrator.
You can now log in and start using the platform.

Login here: ${loginLink}

What's next?
Log in with your email and password to access your personal workspace
and start organizing your projects.

---
This is an automated message from Wayfinder.
Sent at: ${new Date().toISOString()}
    `.trim();

    return await sendEmail(email, subject, html, text);
}

/**
 * Send a rejection notification email to a user
 * @param {string} email - Recipient email address
 * @param {string} displayName - User's display name
 */
export async function sendRejectionEmail(email, displayName = null) {
    const settings = getMailSettings();
    const provider = settings?.mail_provider || 'smtp';

    if (provider === 'sendgrid') {
        if (!process.env.SENDGRID_WEB_API_KEY) {
            throw new Error('SendGrid API key not configured');
        }
        if (!settings.sendgrid_from_email) {
            throw new Error('SendGrid sender email not configured');
        }
    } else {
        if (!settings || !settings.smtp_host) {
            throw new Error('Mail server not configured');
        }
    }

    const subject = 'Wayfinder - Registration Status Update';
    const userName = displayName || 'Applicant';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Registration Status</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); border: 1px solid #333; border-radius: 12px 12px 0 0; text-align: center;">
                                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #8b3daf; letter-spacing: 2px; text-transform: uppercase;">
                                        WAYFINDER
                                    </h1>
                                    <p style="margin: 10px 0 0 0; color: #888; font-size: 14px; letter-spacing: 1px;">
                                        Registration Status Update
                                    </p>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px; background-color: #111; border-left: 1px solid #333; border-right: 1px solid #333;">
                                    <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #e0e0e0;">
                                        Hello, ${userName}
                                    </h2>
                                    <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #999;">
                                        We regret to inform you that your registration request for Wayfinder
                                        has not been approved at this time.
                                    </p>

                                    <div style="padding: 20px; background-color: rgba(107, 114, 128, 0.1); border: 1px solid rgba(107, 114, 128, 0.3); border-radius: 8px; margin-bottom: 20px;">
                                        <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                                            If you believe this was a mistake or would like more information,
                                            please contact your system administrator.
                                        </p>
                                    </div>

                                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #666;">
                                        We appreciate your interest in Wayfinder.
                                    </p>
                                </td>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 25px 30px; background-color: #0d0d0d; border: 1px solid #333; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                                    <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
                                        This is an automated message from Wayfinder.
                                        Please do not reply to this email.
                                    </p>
                                    <p style="margin: 0; font-size: 11px; color: #444;">
                                        Sent at: ${new Date().toISOString()}
                                    </p>
                                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #222;">
                                        <p style="margin: 0; font-size: 11px; color: #555;">
                                            Dark Fantasy Cyberpunk Kanban
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const text = `
WAYFINDER - Registration Status Update

Hello, ${userName}

We regret to inform you that your registration request for Wayfinder
has not been approved at this time.

If you believe this was a mistake or would like more information,
please contact your system administrator.

We appreciate your interest in Wayfinder.

---
This is an automated message from Wayfinder.
Sent at: ${new Date().toISOString()}
    `.trim();

    return await sendEmail(email, subject, html, text);
}

export default {
    encryptPassword,
    decryptPassword,
    getMailSettings,
    getMailSettingsForApi,
    updateMailSettings,
    sendEmail,
    sendTestEmail,
    sendPasswordResetEmail,
    sendApprovalEmail,
    sendRejectionEmail,
    sendWelcomeEmail,
    verifyConnection,
    testSendGridConnection,
    isMailConfigured,
    isSendGridConfigured,
    isSmtpConfigured
};
