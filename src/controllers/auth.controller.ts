import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../db/models/user.model';  

interface AuthRequest extends Request {
  user?: { _id: string };
}

export const signup = async (req: Request, res: Response): Promise<Response> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        error: 'Email is already registered'
      });
    }

    const user = new User(req.body);
    await user.save();

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET as string);
    res.cookie('token', token, { expires: new Date(Date.now() + 9999) });

    return res.json({ token, user });
  } catch (error) {
    console.error(error);
    return res.status(400).json({
      error: 'Failed to create user'
    });
  }
};

export const signin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+encry_password');

    if (!user) {
      return res.status(401).json({
        error: 'Email not found'
      });
    }

    if (!user.authenticate(password)) {
      return res.status(401).json({
        error: 'Email and password do not match'
      });
    }

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET as string);
    res.cookie('token', token, { expires: new Date(Date.now() + 9999) });

    return res.json({ token, user });
  } catch (error) {
    console.error(error);
    return res.status(400).json({
      error: 'Sign in failed'
    });
  }
};

export const signout = (_req: Request, res: Response): Response => {
  res.clearCookie('token');
  return res.json({
    message: 'User signed out successfully'
  });
};

export const isSignedIn = (req: AuthRequest, res: Response, next: NextFunction): Response | void => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access denied. No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { _id: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
}; 