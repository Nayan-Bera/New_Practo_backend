import { Response } from 'express';
import { ERROR_MESSAGES } from '../constants';
import { IRequest } from '../interfaces/IRequest';
import { IUser } from '../interfaces/IUser';
import User from '../db/models/user.model';
import { BaseController } from './base.controller';

class UserController extends BaseController<IUser> {
  constructor() {
    super(User);
  }

  public getProfile = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?._id;
      const user = await User.findById(userId)
        .populate('upcomingExams', 'title startTime duration')
        .populate('pastExams', 'title startTime duration');

      if (!user) {
        return this.sendError(res, 'User not found', 404);
      }

      return this.sendSuccess(res, { user });
    } catch (error) {
      return this.handleError(error, res, 'getProfile');
    }
  };

  public updateProfile = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?._id;
      const { name, email, education, college, university, department, course, designation, profilePicture } = req.body;

      // Check if email is being changed and if it's already taken
      if (email) {
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
          return this.sendError(res, 'Email is already registered', 400);
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { name, email, education, college, university, department, course, designation, profilePicture } },
        { new: true, runValidators: true }
      );

      if (!user) {
        return this.sendError(res, 'User not found', 404);
      }

      return this.sendSuccess(res, { user });
    } catch (error) {
      return this.handleError(error, res, 'updateProfile');
    }
  };

  public changePassword = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?._id;
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(userId).select('+encry_password +salt');
      if (!user) {
        return res.status(404).json({ error: ERROR_MESSAGES.AUTH.USER_NOT_FOUND });
      }

      if (!user.authenticate(currentPassword)) {
        return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
      }

      // Use setPassword method instead of direct assignment
      user.set('password', newPassword);
      await user.save();

      return res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      return res.status(500).json({ error: 'Failed to update password' });
    }
  };

  public getUpcomingExams = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user?._id;
      const user = await User.findById(userId)
        .populate({
          path: 'upcomingExams',
          select: 'title description startTime duration status',
          match: { status: 'upcoming' }
        });

      if (!user) {
        return this.sendError(res, 'User not found', 404);
      }

      return this.sendSuccess(res, { exams: user.upcomingExams });
    } catch (error) {
      return this.handleError(error, res, 'getUpcomingExams');
    }
  };

  // Superadmin: Get all pending admins/teachers
  public getPendingAdmins = async (_req: IRequest, res: Response): Promise<Response> => {
    try {
      const pendingAdmins = await User.find({ type: 'admin', isApproved: false });
      return res.json({ pendingAdmins });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch pending admins' });
    }
  };

  // Superadmin: Approve an admin/teacher
  public approveAdmin = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const { adminId } = req.params;
      const admin = await User.findOneAndUpdate(
        { _id: adminId, type: 'admin' },
        { isApproved: true },
        { new: true }
      );
      if (!admin) return res.status(404).json({ error: 'Admin not found' });
      return res.json({ message: 'Admin approved', admin });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to approve admin' });
    }
  };

  // Superadmin: Reject (delete) an admin/teacher
  public rejectAdmin = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const { adminId } = req.params;
      const admin = await User.findOneAndDelete({ _id: adminId, type: 'admin', isApproved: false });
      if (!admin) return res.status(404).json({ error: 'Admin not found or already approved' });
      return res.json({ message: 'Admin rejected and deleted', admin });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to reject admin' });
    }
  };
}

// Helper to check if candidate profile is complete
export function isCandidateProfileComplete(user: IUser): boolean {
  if (user.type !== 'candidate') return true;
  return Boolean(
    user.name &&
    user.email &&
    user.education &&
    user.college &&
    user.university &&
    user.department &&
    user.course
  );
}

export default new UserController(); 