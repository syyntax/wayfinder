import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base upload directory
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || join(__dirname, '../../data/uploads');
const COVERS_DIR = join(UPLOAD_BASE_DIR, 'covers');
const ATTACHMENTS_DIR = join(UPLOAD_BASE_DIR, 'attachments');
const AVATARS_DIR = join(UPLOAD_BASE_DIR, 'avatars');

// Ensure upload directories exist
[UPLOAD_BASE_DIR, COVERS_DIR, ATTACHMENTS_DIR, AVATARS_DIR].forEach(dir => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
});

// Maximum file sizes
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Allowed MIME types for cover images
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
];

// Allowed MIME types for avatar images (no GIF for avatars)
const ALLOWED_AVATAR_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
];

// Allowed MIME types for general attachments
const ALLOWED_ATTACHMENT_TYPES = [
    ...ALLOWED_IMAGE_TYPES,
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/json',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-7z-compressed',
    'application/x-rar-compressed'
];

/**
 * Sanitize filename to prevent path traversal and other security issues
 */
function sanitizeFilename(filename) {
    // Remove path separators and null bytes
    let sanitized = filename.replace(/[/\\:\0]/g, '_');
    // Remove leading dots to prevent hidden files
    sanitized = sanitized.replace(/^\.+/, '');
    // Limit length
    if (sanitized.length > 200) {
        const ext = extname(sanitized);
        sanitized = sanitized.substring(0, 200 - ext.length) + ext;
    }
    return sanitized || 'file';
}

/**
 * Generate unique filename with UUID
 */
function generateUniqueFilename(originalname) {
    const sanitized = sanitizeFilename(originalname);
    const ext = extname(sanitized).toLowerCase();
    const uuid = uuidv4();
    return `${uuid}${ext}`;
}

/**
 * Check if file is an image
 */
export function isImageFile(mimetype) {
    return ALLOWED_IMAGE_TYPES.includes(mimetype);
}

/**
 * Storage configuration for cover images
 */
const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, COVERS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname);
        cb(null, uniqueName);
    }
});

/**
 * Storage configuration for attachments
 */
const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, ATTACHMENTS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname);
        cb(null, uniqueName);
    }
});

/**
 * Storage configuration for avatar images
 */
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, AVATARS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = generateUniqueFilename(file.originalname);
        cb(null, uniqueName);
    }
});

/**
 * File filter for cover images
 */
const coverImageFilter = (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed for covers.'), false);
    }
};

/**
 * File filter for attachments
 */
const attachmentFilter = (req, file, cb) => {
    if (ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. This file format is not allowed.'), false);
    }
};

/**
 * File filter for avatar images
 */
const avatarImageFilter = (req, file, cb) => {
    if (ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed for avatars.'), false);
    }
};

/**
 * Multer instance for cover image uploads
 */
export const uploadCover = multer({
    storage: coverStorage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter: coverImageFilter
});

/**
 * Multer instance for attachment uploads
 */
export const uploadAttachment = multer({
    storage: attachmentStorage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 5 // Allow up to 5 files at once
    },
    fileFilter: attachmentFilter
});

/**
 * Multer instance for avatar uploads
 */
export const uploadAvatar = multer({
    storage: avatarStorage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter: avatarImageFilter
});

/**
 * Error handling middleware for multer errors
 */
export function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum file size is 5 MB.'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum 5 files allowed per upload.'
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message || 'File upload failed'
        });
    }

    next();
}

// Export directories for use in other modules
export const UPLOAD_DIRS = {
    base: UPLOAD_BASE_DIR,
    covers: COVERS_DIR,
    attachments: ATTACHMENTS_DIR,
    avatars: AVATARS_DIR
};

export default {
    uploadCover,
    uploadAttachment,
    uploadAvatar,
    handleMulterError,
    isImageFile,
    UPLOAD_DIRS
};
