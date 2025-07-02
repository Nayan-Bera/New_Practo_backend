import { Types } from 'mongoose';
import User from '../db/models/user.model';
import Exam from '../db/models/exam.model';
import logger from '../utils/logger';

interface ExamHelper {
  addExamIntoCandidates(list: string[], examid: string): Promise<boolean | any[]>;
  deleExamIntoCandidates(list: string[], examid: string): Promise<boolean | any[]>;
  deleAnsIntoCandidates(answers: Array<{ _id: string; candidateid: string }>): Promise<boolean | any[]>;
  cleanupExams(): Promise<void>;
}

const examHelper: ExamHelper = {
  addExamIntoCandidates: async (list: string[], examid: string): Promise<boolean | any[]> => {
    try {
      const promises = list.map(async (id) => {
        const user = await User.findById(id);
        if (user) {
          user.upcomingExams.push(new Types.ObjectId(examid));
          await user.save();
        }
      });
      return await Promise.all(promises);
    } catch (error) {
      return false;
    }
  },

  deleExamIntoCandidates: async (list: string[], examid: string): Promise<boolean | any[]> => {
    try {
      const promises = list.map(async (id) => {
        const user = await User.findById(id);
        if (user) {
          user.upcomingExams = user.upcomingExams.filter(
            (v) => String(v) !== String(examid)
          );
          await user.save();
        }
      });
      return await Promise.all(promises);
    } catch (error) {
      return false;
    }
  },

  deleAnsIntoCandidates: async (answers: Array<{ _id: string; candidateid: string }>): Promise<boolean | any[]> => {
    try {
      const promises = answers.map(async (answer) => {
        const user = await User.findById(answer.candidateid);
        if (user) {
          user.pastExams = user.pastExams.filter(
            (v) => String(v) !== String(answer._id)
          );
          await user.save();
        }
      });
      return await Promise.all(promises);
    } catch (error) {
      return false;
    }
  },

  cleanupExams: async (): Promise<void> => {
    try {
      const currentDate = new Date();
      
      // Find all exams that have ended
      const pastExams = await Exam.find({
        endTime: { $lt: currentDate }
      }).select('_id candidates');

      if (pastExams.length === 0) {
        return;
      }

      const pastExamIds = pastExams.map(exam => exam._id);
      
      // Update all users who have these exams in their upcoming list
      const updateResult = await User.updateMany(
        { upcomingExams: { $in: pastExamIds } },
        { $pull: { upcomingExams: { $in: pastExamIds } } }
      );

      if (updateResult.modifiedCount > 0) {
        logger.info(`Removed ${pastExamIds.length} past exams from ${updateResult.modifiedCount} users' upcoming exams lists`);
      }
    } catch (error) {
      logger.error('Error in cleanupExams:', error);
      throw error;
    }
  }
};

export default examHelper; 