import { body } from 'express-validator';
import { EXAM_CONSTANTS } from '../constants';

export const createExamValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 3 })
    .withMessage('Title must be at least 3 characters long'),
  
  body('startTime')
    .isISO8601()
    .withMessage('Invalid start time')
    .custom((value: string) => {
      if (new Date(value) < new Date()) {
        throw new Error('Start time cannot be in the past');
      }
      return true;
    }),
  
  body('duration')
    .isInt({ min: EXAM_CONSTANTS.MIN_DURATION, max: EXAM_CONSTANTS.MAX_DURATION })
    .withMessage(`Duration must be between ${EXAM_CONSTANTS.MIN_DURATION} and ${EXAM_CONSTANTS.MAX_DURATION} minutes`),
  
  body('questions')
    .isArray()
    .withMessage('Questions must be an array')
    .custom((questions: unknown[]) => {
      if (questions.length === 0) {
        throw new Error('At least one question is required');
      }
      if (questions.length > EXAM_CONSTANTS.MAX_QUESTIONS) {
        throw new Error(`Maximum ${EXAM_CONSTANTS.MAX_QUESTIONS} questions allowed`);
      }
      return true;
    }),
  
  body('questions.*.question')
    .trim()
    .notEmpty()
    .withMessage('Question text is required'),
  
  body('questions.*.options')
    .isArray({ min: EXAM_CONSTANTS.MIN_OPTIONS })
    .withMessage(`At least ${EXAM_CONSTANTS.MIN_OPTIONS} options are required`)
    .custom((options: unknown[]) => {
      if (options.length > EXAM_CONSTANTS.MAX_OPTIONS) {
        throw new Error(`Maximum ${EXAM_CONSTANTS.MAX_OPTIONS} options allowed`);
      }
      return true;
    }),
  
  body('questions.*.correctAnswer')
    .isInt()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .custom((value: any, { req }: any) => {
      const { options } = req.body.questions[0];
      if (value < 0 || value >= options.length) {
        throw new Error('Invalid correct answer index');
      }
      return true;
    }),
  
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  
  body('settings.requireVideoMonitoring')
    .optional()
    .isBoolean()
    .withMessage('Video monitoring setting must be boolean'),
  
  body('settings.maxWarnings')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max warnings must be at least 1'),
];

export const updateExamValidator = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ min: 3 })
    .withMessage('Title must be at least 3 characters long'),
  
  body('description')
    .optional()
    .trim(),
  
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
];

export const questionValidator = [
  body('question')
    .trim()
    .notEmpty()
    .withMessage('Question text is required')
    .isLength({ min: 5 })
    .withMessage('Question must be at least 5 characters long'),
  
  body('options')
    .isArray({ min: EXAM_CONSTANTS.MIN_OPTIONS, max: EXAM_CONSTANTS.MAX_OPTIONS })
    .withMessage(`Must have between ${EXAM_CONSTANTS.MIN_OPTIONS} and ${EXAM_CONSTANTS.MAX_OPTIONS} options`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .custom((options: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!options.every((option: any) => typeof option === 'string' && option.trim().length > 0)) {
        throw new Error('All options must be non-empty strings');
      }
      return true;
    }),
  
  body('answer')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Answer must be a non-negative integer'),
  
  body('correctAnswer')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Correct answer must be a non-negative integer')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .custom((value: any, { req }: any) => {
      const options = req.body.options;
      if (value >= options.length) {
        throw new Error('Correct answer index is out of range');
      }
      return true;
    }),
  
  body()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .custom((body: any) => {
      // Ensure either answer or correctAnswer is provided
      if (body.answer === undefined && body.correctAnswer === undefined) {
        throw new Error('Either answer or correctAnswer must be provided');
      }
      
      // Validate the answer index against options
      const answerIndex = body.answer !== undefined ? body.answer : body.correctAnswer;
      const options = body.options;
      if (answerIndex >= options.length) {
        throw new Error('Answer index is out of range');
      }
      return true;
    }),
  
  body('marks')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Marks must be a positive integer'),
]; 