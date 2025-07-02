import { Document, Types } from 'mongoose';

export interface IQuestion {
  _id?: Types.ObjectId;
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
}

export interface IAnswer {
  _id?: Types.ObjectId;
  questionId: Types.ObjectId;
  candidateId: Types.ObjectId;
  selectedOption: number;
  timeSpent: number;
}

export interface IVideoMonitoring {
  isEnabled: boolean;
  warningCount: number;
  lastWarningTime?: Date;
  disconnections: Array<{
    startTime: Date;
    endTime?: Date;
    reason?: string;
  }>;
}

export interface ICandidate {
  user: Types.ObjectId;
  status: 'pending' | 'ongoing' | 'completed' | 'disqualified';
  joinTime?: Date;
  submitTime?: Date;
  score?: number;
  warnings: number;
  videoMonitoring: IVideoMonitoring;
  antiCheatingEvents?: Array<{
    eventType: string;
    details?: any;
    timestamp: Date;
  }>;
}

export interface IExamSettings {
  [key: string]: any;
  allowLateSubmission?: boolean;
  shuffleQuestions?: boolean;
  requireVideoMonitoring?: boolean;
  maxWarnings?: number;
  autoDisqualifyOnMaxWarnings?: boolean;
}

export interface IExam extends Document {
  title: string;
  description?: string;
  host: Types.ObjectId;
  startTime: Date;
  duration: number;
  questions: IQuestion[];
  candidates: ICandidate[];
  answers: IAnswer[];
  settings: IExamSettings;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  addCandidate(userId: string): IExam;
  recordWarning(userId: string, reason?: string): IExam;
  recordDisconnection(userId: string, reason?: string): IExam;
  recordReconnection(userId: string): IExam;
} 