import { Router } from 'express';
import { check } from 'express-validator';
import userController from '../controllers/user.controller';
import { isSignedIn, isSuperAdmin } from '../middleware/auth';

const router = Router();

// Get user profile
router.get('/profile', isSignedIn, userController.getProfile);

// Update user profile
router.put('/profile',
  isSignedIn,
  [
    check('name').optional().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
    check('email').optional().isEmail().withMessage('Valid email is required'),
    check('education').optional().isString().withMessage('Education must be a string'),
    check('college').optional().isString().withMessage('College must be a string'),
    check('university').optional().isString().withMessage('University must be a string'),
    check('department').optional().isString().withMessage('Department must be a string'),
    check('course').optional().isString().withMessage('Course must be a string'),
    check('designation').optional().isString().withMessage('Designation must be a string')
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

// Superadmin: Get all pending admins/teachers
router.get('/pending-admins', isSignedIn, isSuperAdmin, userController.getPendingAdmins);

// Superadmin: Approve an admin/teacher
router.put('/approve-admin/:adminId', isSignedIn, isSuperAdmin, userController.approveAdmin);

// Superadmin: Reject (delete) an admin/teacher
router.delete('/reject-admin/:adminId', isSignedIn, isSuperAdmin, userController.rejectAdmin);

export default router; 