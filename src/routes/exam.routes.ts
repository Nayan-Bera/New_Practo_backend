import express from 'express';
import { isAuthenticated, isAdmin, isCandidate } from '../middleware/auth';
import { createExamValidator, updateExamValidator, questionValidator } from '../validators/exam.validator';
import { generalRateLimit } from '../middleware/rateLimit';
import {
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  joinExam,
  submitExam,
  getExam,
  getCurrentExam,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestions,
  getRandomizedQuestions,
  recordAntiCheatingEvent,
  getAntiCheatingReport
} from '../controllers/exam.controller';

const router = express.Router();

// Apply rate limiting to exam routes
router.use(generalRateLimit.middleware());

// Param middleware
router.param('examId', getExamById);

// Admin routes
router.post('/create', isAuthenticated, isAdmin, createExamValidator, createExam);
router.put('/:examId', isAuthenticated, isAdmin, updateExamValidator, updateExam);
router.delete('/:examId', isAuthenticated, isAdmin, deleteExam);

// Question management routes (admin only)
router.post('/:examId/questions', isAuthenticated, isAdmin, questionValidator, addQuestion);
router.put('/:examId/questions/:questionIndex', isAuthenticated, isAdmin, questionValidator, updateQuestion);
router.delete('/:examId/questions/:questionIndex', isAuthenticated, isAdmin, deleteQuestion);
router.get('/:examId/questions', isAuthenticated, getQuestions);
router.get('/:examId/questions/randomized', isAuthenticated, getRandomizedQuestions);

// Candidate routes
router.post('/:examId/join', isAuthenticated, isCandidate, joinExam);
router.post('/:examId/submit', isAuthenticated, isCandidate, submitExam);

// Common routes
router.get('/:examId', isAuthenticated, getExam);
router.get('/current/:examId', isAuthenticated, getCurrentExam);

// Anti-cheating routes
router.post('/:examId/anti-cheating', isAuthenticated, recordAntiCheatingEvent);
router.get('/:examId/anti-cheating-report', isAuthenticated, isAdmin, getAntiCheatingReport);

export default router; 