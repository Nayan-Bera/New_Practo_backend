import { Response } from 'express';
import { Model, Document } from 'mongoose';
import { IRequest } from '../interfaces/IRequest';
import logger from '../utils/logger';

export abstract class BaseController<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  protected async handleError(error: unknown, res: Response, operation: string): Promise<Response> {
    logger.error(`Error in ${operation}:`, error);
    
    // Handle different types of errors
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.message
        });
      }
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Invalid ID format'
        });
      }
      
      if (error.name === 'MongoError' || error.name === 'MongoServerError') {
        // Handle MongoDB specific errors
        const mongoError = error as any;
        if (mongoError.code === 11000) {
          return res.status(409).json({
            error: 'Duplicate entry found'
          });
        }
      }
      
      return res.status(400).json({
        error: error.message
      });
    }
    
    return res.status(500).json({
      error: `Error in ${operation}`
    });
  }

  protected async validateOwnership(
    req: IRequest,
    id: string,
    ownerField: string = 'admin'
  ): Promise<{ isValid: boolean; doc: T | null }> {
    try {
      const doc = await this.model.findById(id);
      if (!doc) {
        return { isValid: false, doc: null };
      }

      const isOwner = String((doc as any)[ownerField]) === String(req.user?._id);
      return { isValid: isOwner, doc };
    } catch (error) {
      logger.error('Error validating ownership:', error);
      return { isValid: false, doc: null };
    }
  }

  protected sendSuccess(res: Response, data: any, message?: string): Response {
    return res.json({
      success: true,
      message,
      data
    });
  }

  protected sendError(res: Response, error: string, status: number = 400): Response {
    return res.status(status).json({
      success: false,
      error
    });
  }

  // Wrapper for async operations with error handling
  protected async safeAsync<T>(
    operation: () => Promise<T>,
    res: Response,
    operationName: string,
    successMessage?: string
  ): Promise<Response | T> {
    try {
      const result = await operation();
      if (successMessage) {
        this.sendSuccess(res, result, successMessage);
      }
      return result;
    } catch (error) {
      return this.handleError(error, res, operationName);
    }
  }

  // Validate required fields
  protected validateRequiredFields(data: any, requiredFields: string[]): string[] {
    const missingFields: string[] = [];
    requiredFields.forEach(field => {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        missingFields.push(field);
      }
    });
    return missingFields;
  }
} 