import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { IRequest } from '../interfaces/IRequest';
import { IExam, ICandidate } from '../interfaces/IExam';
import Exam from '../db/models/exam.model';
import User from '../db/models/user.model';
import { ERROR_MESSAGES } from '../constants';
import { Document, Types } from 'mongoose';
import { VideoMonitoringService } from '../helpers/video.helper';
import { isCandidateProfileComplete } from './user.controller';

type ExamDocument = Document<unknown, Record<string, never>, IExam> & IExam;

export const getExamById = async (
  req: IRequest,
  res: Response,
  next: NextFunction,
  id: string
): Promise<void> => {
  try {
    const exam = await Exam.findById(id) as ExamDocument;
    if (!exam) {
      res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
      return;
    }
    req.exam = exam;
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Invalid exam ID'
    });
  }
};

export const getExam = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    const user = req.user;
    const isAdmin = String(exam.admin) === String(user?._id);
    const isCandidate = exam.candidates.some(c => String(c.user) === String(user?._id));

    if (!isAdmin && !isCandidate) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    // If user is a candidate and exam hasn't started, hide questions
    if (isCandidate && exam.status === 'scheduled') {
      const examWithoutQuestions = exam.toObject();
      examWithoutQuestions.questions = [];
      return res.json(examWithoutQuestions);
    }

    return res.json(exam);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error retrieving exam'
    });
  }
};

export const createExam = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Transform frontend field names to backend field names
    const examData = { ...req.body };
    if (examData.questions) {
      examData.questions = examData.questions.map((q: { answer?: number; correctAnswer?: number; question: string; options: string[]; marks?: number }) => ({
        ...q,
        correctAnswer: q.answer || q.correctAnswer, // Handle both field names
        answer: undefined // Remove the frontend field name
      }));
    }

    const exam = new Exam({
      ...examData,
      admin: req.user?._id
    });

    await exam.save();

    return res.json({
      message: 'Exam created successfully',
      exam
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Error creating exam'
    });
  }
};

export const updateExam = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const exam = req.exam as ExamDocument;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    if (String(exam.admin) !== String(req.user?._id)) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    if (exam.status !== 'scheduled') {
      const restrictedFields = ['startTime', 'duration', 'questions'];
      const hasRestrictedFields = restrictedFields.some(field => req.body[field]);
      
      if (hasRestrictedFields) {
        return res.status(400).json({
          error: ERROR_MESSAGES.EXAM.ALREADY_STARTED
        });
      }
    }

    Object.assign(exam, req.body);
    await exam.save();

    return res.json({
      message: 'Exam updated successfully',
      exam
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Error updating exam'
    });
  }
};

export const deleteExam = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    if (String(exam.admin) !== String(req.user?._id)) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    if (exam.status === 'ongoing') {
      return res.status(400).json({
        error: 'Cannot delete an ongoing exam'
      });
    }

    await exam.deleteOne();

    return res.json({
      message: 'Exam deleted successfully'
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Error deleting exam'
    });
  }
};

export const joinExam = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    // Check candidate profile completeness
    if (!isCandidateProfileComplete(req.user as any)) {
      return res.status(400).json({
        error: 'Please complete your profile (education, college, university, department, course) before joining the exam.'
      });
    }

    if (exam.status !== 'scheduled' && exam.status !== 'ongoing') {
      return res.status(400).json({
        error: 'Exam is not available for joining'
      });
    }

    const isCandidate = exam.candidates.some((c) => String(c.user) === String(req.user?._id));

    if (isCandidate) {
      return res.status(400).json({
        error: 'You have already joined this exam'
      });
    }

    const newCandidate: ICandidate = {
      user: new Types.ObjectId(String(req.user?._id)),
      status: 'pending',
      warnings: 0,
      videoMonitoring: {
        isEnabled: true,
        warningCount: 0,
        disconnections: []
      }
    };

    exam.candidates.push(newCandidate);
    await exam.save();

    await User.findByIdAndUpdate(req.user?._id, {
      $addToSet: { upcomingExams: exam._id }
    });

    return res.json({
      message: 'Successfully joined exam',
      exam
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Error joining exam'
    });
  }
};

export const submitExam = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    const candidate = exam.candidates.find(c => String(c.user) === String(req.user?._id));

    if (!candidate) {
      return res.status(404).json({
        error: 'You are not registered for this exam'
      });
    }

    if (candidate.status === 'completed') {
      return res.status(400).json({
        error: ERROR_MESSAGES.EXAM.ALREADY_SUBMITTED
      });
    }

    if (candidate.status === 'disqualified') {
      return res.status(400).json({
        error: ERROR_MESSAGES.EXAM.DISQUALIFIED
      });
    }

    let score = 0;
    req.body.answers.forEach((answer: number, index: number) => {
      if (answer === exam.questions[index].correctAnswer) {
        score += exam.questions[index].marks;
      }
    });

    candidate.status = 'completed';
    candidate.submitTime = new Date();
    candidate.score = score;

    await exam.save();

    await User.findByIdAndUpdate(req.user?._id, {
      $pull: { upcomingExams: exam._id },
      $addToSet: { pastExams: exam._id }
    });

    return res.json({
      message: 'Exam submitted successfully',
      score
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Error submitting exam'
    });
  }
};

export const addCandidate = async (req: IRequest, res: Response): Promise<Response> => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ error: ERROR_MESSAGES.EXAM.NOT_FOUND });
    }

    const newCandidate: ICandidate = {
      user: new Types.ObjectId(String(req.user?._id)),
      status: 'pending',
      warnings: 0,
      videoMonitoring: {
        isEnabled: true,
        warningCount: 0,
        disconnections: []
      }
    };

    exam.candidates.push(newCandidate);
    await exam.save();

    return res.json({ message: 'Candidate added successfully' });
  } catch (error) {
    console.error('Error adding candidate:', error);
    return res.status(500).json({ error: 'Failed to add candidate' });
  }
};

export const getCurrentExam = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    const user = req.user;
    const isCandidate = exam.candidates.some(c => String(c.user) === String(user?._id));

    if (!isCandidate) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    if (exam.status !== 'ongoing') {
      return res.status(400).json({
        error: 'Exam is not currently active'
      });
    }

    return res.json(exam);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error retrieving current exam'
    });
  }
};

// Question Management Functions
export const addQuestion = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    if (String(exam.admin) !== String(req.user?._id)) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    if (exam.status !== 'scheduled') {
      return res.status(400).json({
        error: ERROR_MESSAGES.EXAM.ALREADY_STARTED
      });
    }

    const { question, options, answer, correctAnswer, marks } = req.body;

    // Transform frontend field name to backend field name
    const finalCorrectAnswer = correctAnswer !== undefined ? correctAnswer : answer;

    // Validate question data
    if (!question || !options || options.length < 2) {
      return res.status(400).json({
        error: 'Question and at least 2 options are required'
      });
    }

    if (finalCorrectAnswer < 0 || finalCorrectAnswer >= options.length) {
      return res.status(400).json({
        error: 'Invalid correct answer index'
      });
    }

    const newQuestion = {
      question,
      options,
      correctAnswer: finalCorrectAnswer,
      marks: marks || 1
    };

    exam.questions.push(newQuestion);
    await exam.save();

    return res.json({
      message: 'Question added successfully',
      question: newQuestion,
      exam
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Error adding question'
    });
  }
};

export const updateQuestion = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    const { questionIndex } = req.params;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    if (String(exam.admin) !== String(req.user?._id)) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    if (exam.status !== 'scheduled') {
      return res.status(400).json({
        error: ERROR_MESSAGES.EXAM.ALREADY_STARTED
      });
    }

    const index = parseInt(questionIndex);
    if (index < 0 || index >= exam.questions.length) {
      return res.status(404).json({
        error: 'Question not found'
      });
    }

    const { question, options, answer, correctAnswer, marks } = req.body;

    // Transform frontend field name to backend field name
    const finalCorrectAnswer = correctAnswer !== undefined ? correctAnswer : answer;

    // Validate question data
    if (!question || !options || options.length < 2) {
      return res.status(400).json({
        error: 'Question and at least 2 options are required'
      });
    }

    if (finalCorrectAnswer < 0 || finalCorrectAnswer >= options.length) {
      return res.status(400).json({
        error: 'Invalid correct answer index'
      });
    }

    exam.questions[index] = {
      ...exam.questions[index],
      question,
      options,
      correctAnswer: finalCorrectAnswer,
      marks: marks || exam.questions[index].marks
    };

    await exam.save();

    return res.json({
      message: 'Question updated successfully',
      question: exam.questions[index],
      exam
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Error updating question'
    });
  }
};

export const deleteQuestion = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    const { questionIndex } = req.params;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    if (String(exam.admin) !== String(req.user?._id)) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    if (exam.status !== 'scheduled') {
      return res.status(400).json({
        error: ERROR_MESSAGES.EXAM.ALREADY_STARTED
      });
    }

    const index = parseInt(questionIndex);
    if (index < 0 || index >= exam.questions.length) {
      return res.status(404).json({
        error: 'Question not found'
      });
    }

    const deletedQuestion = exam.questions.splice(index, 1)[0];
    await exam.save();

    return res.json({
      message: 'Question deleted successfully',
      deletedQuestion,
      exam
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Error deleting question'
    });
  }
};

export const getQuestions = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    const user = req.user;
    const isAdmin = String(exam.admin) === String(user?._id);
    const isCandidate = exam.candidates.some(c => String(c.user) === String(user?._id));

    if (!isAdmin && !isCandidate) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    // If user is a candidate and exam hasn't started, hide questions
    if (isCandidate && exam.status === 'scheduled') {
      return res.json({ questions: [] });
    }

    return res.json({ questions: exam.questions });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error retrieving questions'
    });
  }
};

export const getRandomizedQuestions = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    const user = req.user;
    const isCandidate = exam.candidates.some(c => String(c.user) === String(user?._id));

    if (!isCandidate) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    // If exam hasn't started, hide questions
    if (exam.status === 'scheduled') {
      return res.json({ questions: [] });
    }

    // Check if randomization is enabled for this exam
    const shouldRandomize = exam.settings?.randomizeQuestions ?? true;
    
    if (!shouldRandomize) {
      return res.json({ questions: exam.questions });
    }

    // Create a copy of questions and shuffle them
    const shuffledQuestions = [...exam.questions].map(question => {
      // Create a copy of the question
      const shuffledQuestion = {
        _id: question._id,
        question: question.question,
        options: [...question.options],
        correctAnswer: question.correctAnswer,
        marks: question.marks
      };
      
      // Check if option randomization is enabled
      const shouldRandomizeOptions = exam.settings?.randomizeOptions ?? true;
      
      if (shouldRandomizeOptions) {
        // Create pairs of options with their original indices
        const optionPairs: Array<{ option: string; originalIndex: number }> = shuffledQuestion.options.map((option: string, index: number) => ({
          option,
          originalIndex: index
        }));
        
        // Shuffle the options
        for (let i = optionPairs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [optionPairs[i], optionPairs[j]] = [optionPairs[j], optionPairs[i]];
        }
        
        // Update options and correct answer
        shuffledQuestion.options = optionPairs.map((pair: { option: string; originalIndex: number }) => pair.option);
        const correctOption = optionPairs.find((pair: { option: string; originalIndex: number }) => pair.originalIndex === shuffledQuestion.correctAnswer);
        shuffledQuestion.correctAnswer = correctOption ? optionPairs.indexOf(correctOption) : shuffledQuestion.correctAnswer;
      }
      
      return shuffledQuestion;
    });

    // Shuffle the questions themselves
    for (let i = shuffledQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
    }

    return res.json({ 
      questions: shuffledQuestions,
      randomizationInfo: {
        questionsRandomized: shouldRandomize,
        optionsRandomized: exam.settings?.randomizeOptions ?? true
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error retrieving randomized questions'
    });
  }
};

// Enhanced anti-cheating measures
export const recordAntiCheatingEvent = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    const { eventType, details } = req.body;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: ERROR_MESSAGES.AUTH.UNAUTHORIZED
      });
    }

    const isCandidate = exam.candidates.some(c => String(c.user) === String(user._id));

    if (!isCandidate) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    // Record the anti-cheating event
    const candidate = exam.candidates.find(c => String(c.user) === String(user._id));
    if (candidate) {
      if (!candidate.antiCheatingEvents) {
        candidate.antiCheatingEvents = [];
      }
      
      candidate.antiCheatingEvents.push({
        eventType,
        details,
        timestamp: new Date()
      });

      // Check for suspicious patterns
      const recentEvents = candidate.antiCheatingEvents.filter((event: { eventType: string; timestamp: Date }) => 
        Date.now() - event.timestamp.getTime() < 5 * 60 * 1000 // Last 5 minutes
      );

      const tabSwitchCount = recentEvents.filter((e: { eventType: string }) => e.eventType === 'tab_switch').length;
      const copyPasteCount = recentEvents.filter((e: { eventType: string }) => e.eventType === 'copy_paste').length;
      const rightClickCount = recentEvents.filter((e: { eventType: string }) => e.eventType === 'right_click').length;
      const devToolsCount = recentEvents.filter((e: { eventType: string }) => e.eventType === 'dev_tools').length;

      // Auto-warning thresholds
      if (tabSwitchCount >= 3) {
        await VideoMonitoringService.issueWarning(exam, String(user._id), 'Multiple tab switches detected');
      }
      
      if (copyPasteCount >= 2) {
        await VideoMonitoringService.issueWarning(exam, String(user._id), 'Copy-paste activity detected');
      }
      
      if (rightClickCount >= 5) {
        await VideoMonitoringService.issueWarning(exam, String(user._id), 'Excessive right-click activity');
      }
      
      if (devToolsCount >= 1) {
        await VideoMonitoringService.issueWarning(exam, String(user._id), 'Developer tools access detected');
      }

      await exam.save();
    }

    return res.json({ message: 'Event recorded successfully' });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error recording anti-cheating event'
    });
  }
};

export const getAntiCheatingReport = async (
  req: IRequest,
  res: Response
): Promise<Response> => {
  try {
    const exam = req.exam as ExamDocument;
    
    if (!exam) {
      return res.status(404).json({
        error: ERROR_MESSAGES.EXAM.NOT_FOUND
      });
    }

    const user = req.user;
    const isAdmin = String(exam.admin) === String(user?._id);

    if (!isAdmin) {
      return res.status(403).json({
        error: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED
      });
    }

    // Generate anti-cheating report for all candidates
    const report = exam.candidates.map(candidate => {
      const events = candidate.antiCheatingEvents || [];
      const recentEvents = events.filter((event: { timestamp: Date }) => 
        Date.now() - event.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
      );

      return {
        candidateId: candidate.user,
        totalEvents: events.length,
        recentEvents: recentEvents.length,
        eventBreakdown: {
          tabSwitches: events.filter((e: { eventType: string }) => e.eventType === 'tab_switch').length,
          copyPaste: events.filter((e: { eventType: string }) => e.eventType === 'copy_paste').length,
          rightClicks: events.filter((e: { eventType: string }) => e.eventType === 'right_click').length,
          devTools: events.filter((e: { eventType: string }) => e.eventType === 'dev_tools').length,
          fullscreenExits: events.filter((e: { eventType: string }) => e.eventType === 'fullscreen_exit').length
        },
        riskLevel: calculateRiskLevel(events),
        warnings: candidate.warnings || 0
      };
    });

    return res.json({ report });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error generating anti-cheating report'
    });
  }
};

const calculateRiskLevel = (events: Array<{ eventType: string }>): 'low' | 'medium' | 'high' => {
  const suspiciousEvents = events.filter(e => 
    ['dev_tools', 'copy_paste', 'tab_switch'].includes(e.eventType)
  ).length;

  if (suspiciousEvents === 0) return 'low';
  if (suspiciousEvents <= 3) return 'medium';
  return 'high';
}; 