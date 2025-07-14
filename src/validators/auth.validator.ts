import { body } from 'express-validator';
import { AUTH_CONSTANTS } from '../constants';

export const signupValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: AUTH_CONSTANTS.MIN_NAME_LENGTH })
    .withMessage(`Name must be at least ${AUTH_CONSTANTS.MIN_NAME_LENGTH} characters long`),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: AUTH_CONSTANTS.MIN_PASSWORD_LENGTH })
    .withMessage(`Password must be at least ${AUTH_CONSTANTS.MIN_PASSWORD_LENGTH} characters long`),

  body('type')
    .notEmpty()
    .withMessage('User type is required')
    .isIn(['admin', 'candidate'])
    .withMessage('Invalid user type'),
];

export const signinValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
]; 