import { Response } from 'express';
import { Types } from 'mongoose';
import { ERROR_MESSAGES } from '../constants';
import { IExam, IAnswer } from '../interfaces/IExam';
import { IRequest } from '../interfaces/IRequest';
import Exam from '../db/models/exam.model';
import { BaseController } from './base.controller';

class AnswerController extends BaseController<IExam> {
  constructor() {
    super(Exam);
  }

  public submitAnswer = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const { examId, questionId, selectedOption, timeSpent } = req.body;
      const userId = req.user?._id;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ error: ERROR_MESSAGES.EXAM.NOT_FOUND });
      }

      // Validate if user is a candidate in this exam
      if (!exam.candidates.some(c => c.user.toString() === userId?.toString())) {
        return this.sendError(res, 'You are not authorized to submit answers for this exam', 403);
      }

      // Validate if exam is ongoing
      if (exam.status !== 'ongoing') {
        return this.sendError(res, 'Cannot submit answer: exam is not ongoing', 400);
      }

      // Find the question by _id
      const question = exam.questions.find(q => q._id?.toString() === questionId);
      if (!question) {
        return this.sendError(res, 'Question not found', 404);
      }

      // Validate selected option
      if (selectedOption < 0 || selectedOption >= question.options.length) {
        return this.sendError(res, 'Invalid option selected', 400);
      }

      // Update or create answer
      const answer: IAnswer = {
        questionId: new Types.ObjectId(questionId),
        selectedOption,
        candidateId: new Types.ObjectId(userId?.toString()),
        timeSpent
      };

      const answerIndex = exam.answers?.findIndex(
        a => a.questionId.toString() === questionId && 
             a.candidateId.toString() === userId?.toString()
      );

      if (answerIndex === -1) {
        exam.answers = exam.answers || [];
        exam.answers.push(answer);
      } else {
        exam.answers[answerIndex] = answer;
      }

      await exam.save();

      return this.sendSuccess(res, { message: 'Answer submitted successfully' });
    } catch (error) {
      console.error('Error submitting answer:', error);
      return res.status(500).json({ error: 'Failed to submit answer' });
    }
  };

  public getAnswers = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const { examId } = req.params;
      const userId = req.user?._id;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return this.sendError(res, 'Exam not found', 404);
      }

      // Check if user is authorized (either host or the candidate)
      if (exam.host.toString() !== userId && !exam.candidates.some(c => c.user.toString() === userId?.toString())) {
        return this.sendError(res, 'Not authorized to view answers', 403);
      }

      // If user is candidate, return only their answers
      const answers = exam.host.toString() === userId
        ? exam.answers
        : exam.answers?.filter(a => a.candidateId.toString() === userId?.toString());

      return this.sendSuccess(res, { answers });
    } catch (error) {
      return this.handleError(error, res, 'getAnswers');
    }
  };

  public getResults = async (req: IRequest, res: Response): Promise<Response> => {
    try {
      const { examId } = req.params;
      const userId = req.user?._id;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return this.sendError(res, 'Exam not found', 404);
      }

      // Check if exam is completed
      if (exam.status !== 'completed') {
        return this.sendError(res, 'Results are not available until exam is completed', 400);
      }

      // Check if user is authorized
      if (exam.host.toString() !== userId?.toString() && 
          !exam.candidates.some(c => c.user.toString() === userId?.toString())) {
        return this.sendError(res, 'Not authorized to view results', 403);
      }

      // Calculate results
      const results = exam.candidates.map(candidate => {
        const candidateAnswers = exam.answers?.filter(
          a => a.candidateId.toString() === candidate.user.toString()
        ) || [];

        let score = 0;
        candidateAnswers.forEach(answer => {
          // Find question by questionId (which should match the question _id)
          const question = exam.questions.find(q => q._id?.toString() === answer.questionId.toString());
          if (question && question.correctAnswer === answer.selectedOption) {
            score += question.marks;
          }
        });

        return {
          candidateId: candidate.user,
          score,
          totalQuestions: exam.questions.length,
          answeredQuestions: candidateAnswers.length,
          totalMarks: exam.questions.reduce((sum, q) => sum + q.marks, 0)
        };
      });

      return this.sendSuccess(res, { results });
    } catch (error) {
      return this.handleError(error, res, 'getResults');
    }
  };
}

export default new AnswerController(); 