import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from '../utils/logger';

// Load env vars
dotenv.config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      logger.error('MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    await mongoose.connect(uri);
    logger.info('MongoDB connected successfully');

    // Register all models to ensure schemas are initialized
    await import('./models/user.model');
    await import('./models/exam.model');


  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;
