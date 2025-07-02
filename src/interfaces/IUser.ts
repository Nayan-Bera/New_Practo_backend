import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  encry_password: string;
  salt: string;
  type: 'host' | 'candidate';
  upcomingExams: Types.ObjectId[];
  pastExams: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  authenticate(plainpassword: string): boolean;
  securePassword(plainpassword: string): string;
} 