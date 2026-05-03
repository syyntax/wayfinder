import { body, param, query, validationResult } from 'express-validator';
import { apiResponse } from '../utils/helpers.js';

/**
 * Handle validation errors
 */
export function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json(apiResponse(false, null, 'Validation failed', errors.array()));
    }
    next();
}

/**
 * User registration validation
 */
export const registerValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('username')
        .isLength({ min: 3, max: 30 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username must be 3-30 characters and contain only letters, numbers, underscores, and hyphens'),
    body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
    body('displayName')
        .optional()
        .isLength({ min: 1, max: 100 })
        .trim()
        .escape()
        .withMessage('Display name must be 1-100 characters'),
    handleValidationErrors
];

/**
 * User login validation
 */
export const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    handleValidationErrors
];

/**
 * Board validation
 */
export const boardValidation = [
    body('name')
        .isLength({ min: 1, max: 100 })
        .trim()
        .withMessage('Board name must be 1-100 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .trim()
        .withMessage('Description must be under 500 characters'),
    body('visibility')
        .optional()
        .isIn(['private', 'workspace', 'public'])
        .withMessage('Invalid visibility setting'),
    body('backgroundTheme')
        .optional()
        .isLength({ max: 50 })
        .withMessage('Invalid theme'),
    handleValidationErrors
];

/**
 * List validation
 */
export const listValidation = [
    body('name')
        .isLength({ min: 1, max: 100 })
        .trim()
        .withMessage('List name must be 1-100 characters'),
    body('boardId')
        .notEmpty()
        .withMessage('Board ID is required'),
    handleValidationErrors
];

/**
 * Card validation
 */
export const cardValidation = [
    body('title')
        .isLength({ min: 1, max: 200 })
        .trim()
        .withMessage('Card title must be 1-200 characters'),
    body('listId')
        .notEmpty()
        .withMessage('List ID is required'),
    body('description')
        .optional()
        .isLength({ max: 5000 })
        .withMessage('Description must be under 5000 characters'),
    body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format'),
    body('priority')
        .optional()
        .isString()
        .isLength({ max: 50 })
        .withMessage('Invalid priority'),
    handleValidationErrors
];

/**
 * Comment validation
 */
export const commentValidation = [
    body('content')
        .isLength({ min: 1, max: 2000 })
        .trim()
        .withMessage('Comment must be 1-2000 characters'),
    body('cardId')
        .notEmpty()
        .withMessage('Card ID is required'),
    handleValidationErrors
];

/**
 * UUID parameter validation
 */
export const uuidParam = (paramName) => [
    param(paramName)
        .isUUID()
        .withMessage(`Invalid ${paramName}`),
    handleValidationErrors
];

/**
 * Workspace validation
 */
export const workspaceValidation = [
    body('name')
        .isLength({ min: 1, max: 100 })
        .trim()
        .withMessage('Workspace name must be 1-100 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .trim()
        .withMessage('Description must be under 500 characters'),
    handleValidationErrors
];

export default {
    handleValidationErrors,
    registerValidation,
    loginValidation,
    boardValidation,
    listValidation,
    cardValidation,
    commentValidation,
    uuidParam,
    workspaceValidation
};
