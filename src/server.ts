import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import logger from './utils/logger';
import connectDB from './db/connection';
import SocketService from './helpers/socket.helper';
import { securityHeaders, sanitizeInput } from './middleware/security';

// Routes
import authRoutes from './routes/auth.routes';
import examRoutes from './routes/exam.routes';
import userRoutes from './routes/user.routes';
import answerRoutes from './routes/answer.routes';

// Load env vars
dotenv.config();

// Validate critical environment variables
const validateEnvironment = () => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'MONGODB_URI',
    'NODE_ENV'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET!.length < 32) {
    logger.error('JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  logger.info('Environment validation passed');
};

// Initialize app 
const app = express();
const server = createServer(app);

// Initialize socket
new SocketService(server);

// Security middleware
app.use(securityHeaders);
app.use(sanitizeInput);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/user', userRoutes);
app.use('/api/answer', answerRoutes);

// Connect DB and start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Validate environment first
    validateEnvironment();
    
    // Connect to database
    await connectDB();
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Error Handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.message
  });
});
