export const SECURITY_CONFIG = {
  // JWT Configuration
  JWT: {
    SECRET_MIN_LENGTH: 32,
    EXPIRES_IN: '7d',
    REFRESH_EXPIRES_IN: '30d',
    ALGORITHM: 'HS256'
  },

  // Rate Limiting
  RATE_LIMITS: {
    GENERAL: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100
    },
    AUTH: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 5
    },
    VIDEO: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 30
    },
    SOCKET: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 50
    }
  },

  // Password Policy
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    MAX_AGE_DAYS: 90
  },

  // Session Management
  SESSION: {
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    SECURE: process.env.NODE_ENV === 'production',
    HTTP_ONLY: true,
    SAME_SITE: 'strict' as const
  },

  // CORS Configuration
  CORS: {
    ALLOWED_ORIGINS: [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'https://yourdomain.com'
    ],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
    CREDENTIALS: true
  },

  // File Upload
  FILE_UPLOAD: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif']
  },

  // Input Validation
  INPUT: {
    MAX_STRING_LENGTH: 1000,
    MAX_ARRAY_LENGTH: 100,
    SANITIZE_HTML: true,
    BLOCKED_CHARS: ['<', '>', 'script', 'javascript:']
  },

  // WebRTC Security
  WEBRTC: {
    ICE_SERVERS: [
      {
        urls: 'stun:stun.l.google.com:19302'
      },
      {
        urls: 'turn:your-turn-server.com:3478',
        username: process.env.TURN_USERNAME || 'username',
        credential: process.env.TURN_CREDENTIAL || 'password'
      }
    ],
    ICE_TRANSPORT_POLICY: 'relay' as const,
    BUNDLE_POLICY: 'max-bundle' as const,
    RTCP_MUX_POLICY: 'require' as const
  },

  // Socket Security
  SOCKET: {
    MAX_RECONNECTION_ATTEMPTS: 3,
    RECONNECTION_TIMEOUT: 30000, // 30 seconds
    PING_TIMEOUT: 60000, // 60 seconds
    PING_INTERVAL: 25000 // 25 seconds
  },

  // Database Security
  DATABASE: {
    MAX_CONNECTIONS: 10,
    CONNECTION_TIMEOUT: 30000,
    QUERY_TIMEOUT: 10000
  },

  // Logging
  LOGGING: {
    LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    SENSITIVE_FIELDS: ['password', 'token', 'secret', 'key'],
    MAX_LOG_SIZE: 10 * 1024 * 1024 // 10MB
  }
};

// Security headers configuration
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

// Validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  MONGO_ID: /^[0-9a-fA-F]{24}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  ALPHANUMERIC_SPACES: /^[a-zA-Z0-9\s]+$/
};

// Error messages
export const SECURITY_ERROR_MESSAGES = {
  INVALID_INPUT: 'Invalid input provided',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  INVALID_TOKEN: 'Invalid or expired token',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  FILE_TOO_LARGE: 'File size exceeds maximum allowed size',
  INVALID_FILE_TYPE: 'File type not allowed',
  INVALID_ID_FORMAT: 'Invalid ID format',
  SESSION_EXPIRED: 'Session has expired. Please log in again.'
}; 