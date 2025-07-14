import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  encry_password: string;
  salt: string;
  type: 'superadmin' | 'admin' | 'candidate';
  education: string;
  college: string;
  university: string;
  department: string;
  course: string;
  designation: string;
  upcomingExams: Types.ObjectId[];
  pastExams: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  isApproved: boolean;
  authenticate(plainpassword: string): boolean;
  securePassword(plainpassword: string): string;
} 