import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { initializeDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import passwordResetRoutes from './routes/passwordReset.js';
import boardRoutes from './routes/boards.js';
import listRoutes from './routes/lists.js';
import cardRoutes from './routes/cards.js';
import commentRoutes from './routes/comments.js';
import workspaceRoutes from './routes/workspaces.js';
import checklistRoutes from './routes/checklists.js';
import labelRoutes from './routes/labels.js';
import attachmentRoutes from './routes/attachments.js';
import userRoutes from './routes/users.js';
import mailRoutes from './routes/mail.js';
import userManagementRoutes from './routes/userManagement.js';
import appSettingsRoutes from './routes/appSettings.js';
import { UPLOAD_DIRS } from './middleware/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize database
initializeDatabase();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Handled by frontend/nginx in production
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:8008', 'http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per window
    message: { success: false, message: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Wayfinder API is running',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV
    });
});

// Serve uploaded files BEFORE API routes so they don't require authentication
// Note: Do NOT set restrictive CSP headers on image responses as they prevent display
app.use('/api/uploads/covers', express.static(UPLOAD_DIRS.covers, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'public, max-age=604800, immutable');
    }
}));

app.use('/api/uploads/attachments', express.static(UPLOAD_DIRS.attachments, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        res.set('X-Content-Type-Options', 'nosniff');
        // Force download for non-image files
        const ext = filePath.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!imageExts.includes(ext)) {
            res.set('Content-Disposition', 'attachment');
        } else {
            res.set('Cache-Control', 'public, max-age=604800, immutable');
        }
    }
}));

app.use('/api/uploads/avatars', express.static(UPLOAD_DIRS.avatars, {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'public, max-age=604800, immutable');
    }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/admin', userManagementRoutes);
app.use('/api/admin', appSettingsRoutes);
app.use('/api/settings', appSettingsRoutes);
app.use('/api', attachmentRoutes);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// Serve static frontend files in production
if (NODE_ENV === 'production') {
    const publicPath = join(__dirname, '../public');
    app.use(express.static(publicPath));

    // Handle SPA routing - serve index.html for all non-API routes
    app.get('*', (req, res) => {
        res.sendFile(join(publicPath, 'index.html'));
    });
}

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'CORS error: Origin not allowed'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗    ██╗ █████╗ ██╗   ██╗███████╗██╗███╗   ██╗██████╗    ║
║   ██║    ██║██╔══██╗╚██╗ ██╔╝██╔════╝██║████╗  ██║██╔══██╗   ║
║   ██║ █╗ ██║███████║ ╚████╔╝ █████╗  ██║██╔██╗ ██║██║  ██║   ║
║   ██║███╗██║██╔══██║  ╚██╔╝  ██╔══╝  ██║██║╚██╗██║██║  ██║   ║
║   ╚███╔███╔╝██║  ██║   ██║   ██║     ██║██║ ╚████║██████╔╝   ║
║    ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═══╝╚═════╝    ║
║                                                               ║
║   Dark Fantasy Cyberpunk Kanban                              ║
║   API Server v1.0.0                                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

    Server running on port ${PORT}
    Environment: ${NODE_ENV}
    Ready to accept connections...
    `);
});

export default app;
