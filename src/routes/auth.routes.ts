import { Router } from 'express';
import { signup, signin, signout, isSignedIn } from '../controllers/auth.controller';
import { signupValidator, signinValidator } from '../validators/auth.validator';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

// Apply rate limiting to auth routes
router.use(authRateLimit.middleware());

// Auth routes
router.post('/signup', signupValidator, signup);
router.post('/signin', signinValidator, signin);
router.get('/signout', signout);
router.get('/isSignedIn', isSignedIn);

export default router; 