import { validationResult } from 'express-validator';
import { apiResponse } from '../utils/helpers.js';

/**
 * Middleware to handle validation errors from express-validator
 */
export function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json(apiResponse(false, null, 'Validation failed', errors.array()));
    }
    next();
}
