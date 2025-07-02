import { Router } from 'express';
import { check } from 'express-validator';
import answerController from '../controllers/answer.controller';
import { isSignedIn } from '../middleware/auth';

const router = Router();

// Submit an answer
router.post('/submit',
  isSignedIn,
  [
    check('examId').isMongoId().withMessage('Valid exam ID is required'),
    check('questionId').isMongoId().withMessage('Valid question ID is required'),
    check('selectedOption').isNumeric().withMessage('Selected option must be a number'),
    check('timeSpent').isNumeric().withMessage('Time spent must be a number')
  ],
  answerController.submitAnswer
);

// Get answers for an exam
router.get('/:examId',
  isSignedIn,
  [
    check('examId').isMongoId().withMessage('Valid exam ID is required')
  ],
  answerController.getAnswers
);

// Get results for an exam
router.get('/:examId/results',
  isSignedIn,
  [
    check('examId').isMongoId().withMessage('Valid exam ID is required')
  ],
  answerController.getResults
);

export default router; 