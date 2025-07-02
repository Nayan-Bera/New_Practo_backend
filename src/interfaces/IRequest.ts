import { Request } from 'express';
import { Document } from 'mongoose';
import { IUser } from '../db/models/user.model';
import { IExam } from './IExam';

export interface IRequest extends Request {
  user?: Document<unknown, any, IUser> & IUser;
  exam?: IExam;
  token?: string;
  files?: any; // For file uploads
} 