import { Response, NextFunction } from 'express';
import { IRequest } from '../interfaces/IRequest';
import logger from '../utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private getKey(req: IRequest): string {
    // Use IP address as key, fallback to user ID if authenticated
    const ip = (req.ip as string) || (req.connection?.remoteAddress as string) || 'unknown';
    return req.user?._id ? String(req.user._id) : ip;
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  middleware() {
    return (req: IRequest, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();

      // Initialize or get existing entry
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 0,
          resetTime: now + this.windowMs
        };
      }

      // Increment request count
      this.store[key].count++;

      // Check if limit exceeded
      if (this.store[key].count > this.maxRequests) {
        logger.warn(`Rate limit exceeded for ${key}`);
        return res.status(429).json({
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
        });
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.maxRequests.toString(),
        'X-RateLimit-Remaining': (this.maxRequests - this.store[key].count).toString(),
        'X-RateLimit-Reset': new Date(this.store[key].resetTime).toISOString()
      });

      return next();
    };
  }
}

// Create different rate limiters for different endpoints
export const generalRateLimit = new RateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const authRateLimit = new RateLimiter(15 * 60 * 1000, 5); // 5 auth attempts per 15 minutes
export const videoRateLimit = new RateLimiter(60 * 1000, 30); // 30 video requests per minute
export const socketRateLimit = new RateLimiter(60 * 1000, 50); // 50 socket events per minute

export default RateLimiter; 