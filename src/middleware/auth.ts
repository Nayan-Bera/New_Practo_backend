import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ERROR_MESSAGES } from '../constants';
import { IRequest } from '../interfaces/IRequest';
import User from '../db/models/user.model';

export const isAuthenticated = async (
  req: IRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: ERROR_MESSAGES.AUTH.UNAUTHORIZED
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { _id: string };
    const user = await User.findById(decoded._id);

    if (!user) {
      return res.status(401).json({
        error: ERROR_MESSAGES.AUTH.USER_NOT_FOUND
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: ERROR_MESSAGES.AUTH.TOKEN_EXPIRED
      });
    }
    return res.status(401).json({
      error: ERROR_MESSAGES.AUTH.TOKEN_INVALID
    });
  }
};

// Alias isAuthenticated as isSignedIn for backward compatibility
export const isSignedIn = isAuthenticated;

export const isAdmin = (
  req: IRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user && req.user.type === 'admin') {
    return next();
  }
  return res.status(403).json({
    error: 'Access denied. Only admins can perform this action.'
  });
};

export const isCandidate = (
  req: IRequest,
  res: Response,
  next: NextFunction
): void | Response => {
  if (req.user?.type !== 'candidate') {
    return res.status(403).json({
      error: 'Access denied. Only candidates can perform this action.'
    });
  }
  next();
};

export const isSuperAdmin = (
  req: IRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user && req.user.type === 'superadmin') {
    return next();
  }
  return res.status(403).json({
    error: 'Access denied. Only super admins can perform this action.'
  });
}; 