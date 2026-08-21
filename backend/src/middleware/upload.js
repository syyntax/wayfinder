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

// Static limits for covers and avatars (not admin-configurable)
const COVER_MAX_SIZE = 10 * 1024 * 1024;  // 10 MB
const AVATAR_MAX_SIZE = 5 * 1024 * 1024;  // 5 MB

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

// Complete extension → MIME type mapping for attachment uploads
export const EXTENSION_MIME_MAP = {
    jpg:  ['image/jpeg', 'image/jpg'],
    jpeg: ['image/jpeg', 'image/jpg'],
    png:  ['image/png'],
    gif:  ['image/gif'],
    webp: ['image/webp'],
    pdf:  ['application/pdf'],
    doc:  ['application/msword'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    xls:  ['application/vnd.ms-excel'],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ppt:  ['application/vnd.ms-powerpoint'],
    pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    txt:  ['text/plain'],
    csv:  ['text/csv'],
    md:   ['text/markdown'],
    json: ['application/json'],
    zip:  ['application/zip', 'application/x-zip-compressed'],
    '7z': ['application/x-7z-compressed'],
    rar:  ['application/x-rar-compressed'],
};

export const DEFAULT_ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv', 'md', 'json', 'zip', '7z', 'rar',
];

export const DEFAULT_MAX_UPLOAD_SIZE_MB = 10;

function extensionsToMimeTypes(extensions) {
    const mimes = new Set();
    for (const ext of extensions) {
        const types = EXTENSION_MIME_MAP[ext.toLowerCase()];
        if (types) types.forEach(t => mimes.add(t));
    }
    return [...mimes];
}

// Module-level cache for admin-configured upload settings
let uploadConfig = {
    maxFileSizeBytes: DEFAULT_MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    allowedMimeTypes: extensionsToMimeTypes(DEFAULT_ALLOWED_EXTENSIONS),
    maxSizeMb: DEFAULT_MAX_UPLOAD_SIZE_MB,
    allowedExtensions: DEFAULT_ALLOWED_EXTENSIONS,
};

/**
 * Refresh the upload config cache from the database.
 * Call at server startup and after admin settings are saved.
 */
export function refreshUploadConfig(db) {
    try {
        const row = db.prepare(
            'SELECT max_upload_size_mb, allowed_attachment_extensions FROM app_settings WHERE id = 1'
        ).get();
        if (row) {
            const sizeMb = row.max_upload_size_mb || DEFAULT_MAX_UPLOAD_SIZE_MB;
            const exts = row.allowed_attachment_extensions
                ? JSON.parse(row.allowed_attachment_extensions)
                : DEFAULT_ALLOWED_EXTENSIONS;
            uploadConfig = {
                maxFileSizeBytes: sizeMb * 1024 * 1024,
                allowedMimeTypes: extensionsToMimeTypes(exts),
                maxSizeMb: sizeMb,
                allowedExtensions: exts,
            };
        }
    } catch (err) {
        console.error('[upload] Failed to refresh upload config:', err.message);
    }
}

export function getUploadConfig() {
    return uploadConfig;
}

/**
 * Sanitize filename to prevent path traversal and other security issues
 */
function sanitizeFilename(filename) {
    let sanitized = filename.replace(/[/\\:\0]/g, '_');
    sanitized = sanitized.replace(/^\.+/, '');
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

// Storage configurations
const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, COVERS_DIR),
    filename: (req, file, cb) => cb(null, generateUniqueFilename(file.originalname))
});

const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, ATTACHMENTS_DIR),
    filename: (req, file, cb) => cb(null, generateUniqueFilename(file.originalname))
});

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATARS_DIR),
    filename: (req, file, cb) => cb(null, generateUniqueFilename(file.originalname))
});

// Static multer instances for covers and avatars
export const uploadCover = multer({
    storage: coverStorage,
    limits: { fileSize: COVER_MAX_SIZE, files: 1 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed for covers.'), false);
        }
    }
});

export const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: AVATAR_MAX_SIZE, files: 1 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed for avatars.'), false);
        }
    }
});

/**
 * Dynamic attachment upload middleware — reads limits from the admin-configured cache.
 * Replaces the static uploadAttachment multer instance.
 */
export function uploadAttachment(req, res, next) {
    const config = uploadConfig;
    const instance = multer({
        storage: attachmentStorage,
        limits: { fileSize: config.maxFileSizeBytes, files: 5 },
        fileFilter: (req, file, cb) => {
            const ext = extname(file.originalname).toLowerCase().replace(/^\./, '');
            if (config.allowedExtensions.includes(ext)) {
                cb(null, true);
            } else {
                cb(new Error(`File type ".${ext}" is not allowed.`), false);
            }
        }
    });
    instance.array('files', 5)(req, res, next);
}

/**
 * Error handling middleware for multer errors
 */
export function handleMulterError(err, req, res, next) {
    if (!err) return next();

    // Drain the remaining request body so the browser receives the error response
    // cleanly rather than seeing a TCP connection reset mid-upload.
    req.resume();

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: `File too large. Maximum file size is ${uploadConfig.maxSizeMb} MB.`
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

    return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed'
    });
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
    refreshUploadConfig,
    getUploadConfig,
    UPLOAD_DIRS,
    EXTENSION_MIME_MAP,
    DEFAULT_ALLOWED_EXTENSIONS,
    DEFAULT_MAX_UPLOAD_SIZE_MB,
};
