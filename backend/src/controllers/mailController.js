import {
    getMailSettingsForApi,
    updateMailSettings,
    sendTestEmail,
    verifyConnection
} from '../services/mailService.js';
import { apiResponse } from '../utils/helpers.js';

/**
 * Get current mail settings (password masked)
 * GET /api/mail/settings
 */
export async function getSettings(req, res) {
    try {
        const settings = getMailSettingsForApi();

        res.json(apiResponse(true, settings, 'Mail settings retrieved'));
    } catch (error) {
        console.error('Get mail settings error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to retrieve mail settings'));
    }
}

/**
 * Update mail settings
 * PUT /api/mail/settings
 */
export async function updateSettings(req, res) {
    try {
        const {
            mail_provider,
            smtp_host,
            smtp_port,
            smtp_secure,
            smtp_username,
            smtp_password,
            from_email,
            from_name,
            sendgrid_from_email,
            sendgrid_from_name
        } = req.body;

        // Validate mail_provider if provided
        if (mail_provider !== undefined && mail_provider !== null) {
            if (!['smtp', 'sendgrid'].includes(mail_provider)) {
                return res.status(400).json(apiResponse(false, null, 'Invalid mail provider. Must be "smtp" or "sendgrid"'));
            }

            // If switching to SendGrid, validate that API key is configured
            if (mail_provider === 'sendgrid' && !process.env.SENDGRID_WEB_API_KEY) {
                return res.status(400).json(apiResponse(false, null, 'Cannot enable SendGrid: SENDGRID_WEB_API_KEY environment variable is not set'));
            }
        }

        // Validate SMTP email format if provided
        if (from_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(from_email)) {
                return res.status(400).json(apiResponse(false, null, 'Invalid SMTP from email address format'));
            }
        }

        // Validate SendGrid email format if provided
        if (sendgrid_from_email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(sendgrid_from_email)) {
                return res.status(400).json(apiResponse(false, null, 'Invalid SendGrid from email address format'));
            }
        }

        // Validate port number
        if (smtp_port !== undefined) {
            const port = parseInt(smtp_port);
            if (isNaN(port) || port < 1 || port > 65535) {
                return res.status(400).json(apiResponse(false, null, 'Invalid SMTP port number'));
            }
        }

        // Validate SMTP host format (basic check)
        if (smtp_host !== undefined && smtp_host !== null && smtp_host !== '') {
            const hostRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$/;
            if (!hostRegex.test(smtp_host)) {
                return res.status(400).json(apiResponse(false, null, 'Invalid SMTP host format'));
            }
        }

        const settings = updateMailSettings({
            mail_provider,
            smtp_host,
            smtp_port,
            smtp_secure,
            smtp_username,
            smtp_password,
            from_email,
            from_name,
            sendgrid_from_email,
            sendgrid_from_name
        });

        res.json(apiResponse(true, settings, 'Mail settings updated successfully'));
    } catch (error) {
        console.error('Update mail settings error:', error);
        res.status(500).json(apiResponse(false, null, 'Failed to update mail settings'));
    }
}

/**
 * Send a test email
 * POST /api/mail/test
 */
export async function testEmail(req, res) {
    try {
        const { test_email } = req.body;

        if (!test_email) {
            return res.status(400).json(apiResponse(false, null, 'Test email address is required'));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(test_email)) {
            return res.status(400).json(apiResponse(false, null, 'Invalid email address format'));
        }

        const result = await sendTestEmail(test_email);

        res.json(apiResponse(true, {
            messageId: result.messageId,
            recipient: test_email
        }, 'Test email sent successfully'));
    } catch (error) {
        console.error('Send test email error:', error);

        // Provide more specific error messages
        let errorMessage = 'Failed to send test email';

        if (error.message.includes('not configured')) {
            errorMessage = error.message;
        } else if (error.message.includes('SendGrid')) {
            errorMessage = error.message;
        } else if (error.code === 'ECONNECTION' || error.code === 'ECONNREFUSED') {
            errorMessage = 'Could not connect to SMTP server. Please check host and port.';
        } else if (error.code === 'EAUTH' || error.message.includes('authentication')) {
            errorMessage = 'SMTP authentication failed. Please check username and password.';
        } else if (error.code === 'ESOCKET' || error.message.includes('socket')) {
            errorMessage = 'Connection error. Check if TLS setting matches your SMTP server.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        res.status(500).json(apiResponse(false, null, errorMessage));
    }
}

/**
 * Verify mail connection (SMTP or SendGrid)
 * POST /api/mail/verify
 */
export async function verifySettings(req, res) {
    try {
        const result = await verifyConnection();

        res.json(apiResponse(true, result, result.message || 'Mail connection verified'));
    } catch (error) {
        console.error('Verify mail settings error:', error);

        let errorMessage = 'Mail connection verification failed';
        if (error.message.includes('not configured')) {
            errorMessage = error.message;
        } else if (error.message.includes('SendGrid')) {
            errorMessage = error.message;
        } else if (error.message) {
            errorMessage = error.message;
        }

        res.status(500).json(apiResponse(false, null, errorMessage));
    }
}

export default {
    getSettings,
    updateSettings,
    testEmail,
    verifySettings
};
