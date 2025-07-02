import { NextFunction, Response } from 'express';
import { IRequest } from '../interfaces/IRequest';
import logger from '../utils/logger';

// Input sanitization
export const sanitizeInput = (req: IRequest, _res: Response, next: NextFunction) => {
  try {
    // Sanitize body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Remove potentially dangerous characters
          req.body[key] = req.body[key]
            .replace(/[<>]/g, '') // Remove < and >
            .trim();
        }
      });
    }

    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = (req.query[key] as string)
            .replace(/[<>]/g, '')
            .trim();
        }
      });
    }

    return next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    return next();
  }
};

// Validate exam ID format
export const validateExamId = (req: IRequest, res: Response, next: NextFunction) => {
  const examId = req.params.examId || req.body.examId;
  
  if (examId && !/^[0-9a-fA-F]{24}$/.test(examId)) {
    return res.status(400).json({
      error: 'Invalid exam ID format'
    });
  }
  
  return next();
};

// Validate user ID format
export const validateUserId = (req: IRequest, res: Response, next: NextFunction) => {
  const userId = req.params.userId || req.body.userId;
  
  if (userId && !/^[0-9a-fA-F]{24}$/.test(userId)) {
    return res.status(400).json({
      error: 'Invalid user ID format'
    });
  }
  
  return next();
};

// Prevent common security headers
export const securityHeaders = (_req: IRequest, res: Response, next: NextFunction) => {
  // Security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  });
  
  return next();
};

// Validate file uploads
export const validateFileUpload = (req: IRequest, res: Response, next: NextFunction) => {
  if (req.files) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    for (const file of Object.values(req.files)) {
      if (Array.isArray(file)) {
        const invalidFile = file.find(f => !validateFile(f, allowedTypes, maxSize));
        if (invalidFile) {
          return res.status(400).json({
            error: 'Invalid file detected in upload.'
          });
        }
      } else {
        if (!validateFile(file, allowedTypes, maxSize)) {
          return res.status(400).json({
            error: 'Invalid file detected in upload.'
          });
        }
      }
    }
  }
  
  return next();
};

const validateFile = (file: any, allowedTypes: string[], maxSize: number): boolean => {
  if (file.size > maxSize) {
    return false;
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    return false;
  }
  
  return true;
};

// Rate limiting for specific endpoints
export const strictRateLimit = (req: IRequest, res: Response, next: NextFunction) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10; // 10 requests per minute
  
  // This is a simple in-memory rate limiter
  // In production, use Redis or a similar service
  if (!req.app.locals.rateLimitStore) {
    req.app.locals.rateLimitStore = new Map();
  }
  
  const store = req.app.locals.rateLimitStore;
  const userData = store.get(key);
  
  if (!userData || userData.resetTime < now) {
    store.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
  } else {
    userData.count++;
    if (userData.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }
  }
  
  return next();
}; 