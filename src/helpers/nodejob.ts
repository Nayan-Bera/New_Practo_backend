import { Document } from 'mongoose';
import Exam from '../db/models/exam.model';
import User from '../db/models/user.model';

interface IExamRef {
  examid: string;
}

interface IUser extends Document {
  upcomingexams: IExamRef[];
}

interface IExam extends Document {
  _id: string;
  endingtime: string | Date;
}

const nodejob = async (): Promise<void> => {
  try {
    const users: IUser[] = await User.find();
    const promises = users.map(async (user: IUser) => {
      const examPromises = user.upcomingexams.map(async (exam: IExamRef) => {
        const ex: IExam | null = await Exam.findById(exam.examid);
        if (ex) {
          const end: number = Date.parse(ex.endingtime.toString());
          const now: number = Date.now();
          if (now > end) {
            user.upcomingexams = user.upcomingexams.filter(
              (v) => String(v.examid) !== String(ex._id)
            );
            await user.save();
          }
        }
      });
      
      // Wait for all exam promises to complete
      await Promise.all(examPromises);
    });
    
    // Wait for all user promises to complete
    await Promise.all(promises);
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : 'Unknown error');
  }
};

export default nodejob; 