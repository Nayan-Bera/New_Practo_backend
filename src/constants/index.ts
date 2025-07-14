export const AUTH_CONSTANTS = {
  JWT_EXPIRES_IN: '7d',
  SALT_ROUNDS: 10,
  MIN_PASSWORD_LENGTH: 6,
  MIN_NAME_LENGTH: 3,
};

export const EXAM_CONSTANTS = {
  MAX_WARNINGS: 3,
  MIN_DURATION: 5, // minutes
  MAX_DURATION: 180, // minutes
  MAX_QUESTIONS: 100,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 6,
};

export const VIDEO_CONSTANTS = {
  RECONNECTION_TIMEOUT: 30000, // 30 seconds
  WARNING_COOLDOWN: 60000, // 1 minute
  MAX_DISCONNECTIONS: 3,
};

export const ERROR_MESSAGES = {
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    USER_NOT_FOUND: 'User not found',
    UNAUTHORIZED: 'Unauthorized access',
    TOKEN_EXPIRED: 'Token has expired',
    TOKEN_INVALID: 'Invalid token',
  },
  EXAM: {
    NOT_FOUND: 'Exam not found',
    ALREADY_STARTED: 'Exam has already started',
    ALREADY_ENDED: 'Exam has already ended',
    NOT_AUTHORIZED: 'You are not authorized for this action',
    ALREADY_SUBMITTED: 'You have already submitted this exam',
    DISQUALIFIED: 'You have been disqualified from this exam',
  },
  VIDEO: {
    ACCESS_DENIED: 'Camera access denied',
    CONNECTION_LOST: 'Video connection lost',
    TOO_MANY_DISCONNECTIONS: 'Too many video disconnections',
  },
};

export const USER_ROLE_SUPERADMIN = 'superadmin'; 