import { Router } from 'express';
import { check } from 'express-validator';
import userController from '../controllers/user.controller';
import { isSignedIn } from '../middleware/auth';

const router = Router();

// Get user profile
router.get('/profile', isSignedIn, userController.getProfile);

// Update user profile
router.put('/profile',
  isSignedIn,
  [
    check('name').optional().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
    check('email').optional().isEmail().withMessage('Valid email is required')
  ],
  userController.updateProfile
);

// Change password
router.put('/change-password',
  isSignedIn,
  [
    check('currentPassword').notEmpty().withMessage('Current password is required'),
    check('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters')
  ],
  userController.changePassword
);

// Get upcoming exams
router.get('/upcoming-exams', isSignedIn, userController.getUpcomingExams);

export default router; 