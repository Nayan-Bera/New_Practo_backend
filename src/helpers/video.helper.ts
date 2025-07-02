import { VIDEO_CONSTANTS } from '../constants';
import { IExam } from '../interfaces/IExam';
import logger from '../utils/logger';

export interface IVideoAnalysisResult {
  hasMultipleFaces: boolean;
  hasNoFace: boolean;
  hasUnusualMovement: boolean;
  confidence: number;
  timestamp: Date;
}

export interface IVideoAnalysisData {
  frameData: string; // Base64 encoded frame
  timestamp: Date;
  userId: string;
  examId: string;
}

export class VideoMonitoringService {
  private static warningCooldowns: Map<string, Date> = new Map();
  private static analysisResults: Map<string, IVideoAnalysisResult[]> = new Map(); // userId -> results

  static canIssueWarning(userId: string): boolean {
    const lastWarning = this.warningCooldowns.get(userId);
    if (!lastWarning) return true;

    const timeSinceLastWarning = Date.now() - lastWarning.getTime();
    return timeSinceLastWarning >= VIDEO_CONSTANTS.WARNING_COOLDOWN;
  }

  // Automated video analysis
  static async analyzeVideoFrame(data: IVideoAnalysisData): Promise<IVideoAnalysisResult> {
    try {
      // This is a simplified analysis - in a real implementation, you would:
      // 1. Use a computer vision library like OpenCV or TensorFlow.js
      // 2. Implement face detection using libraries like face-api.js
      // 3. Use motion detection algorithms
      // 4. Implement object detection for phones, books, etc.

      const result: IVideoAnalysisResult = {
        hasMultipleFaces: false,
        hasNoFace: false,
        hasUnusualMovement: false,
        confidence: 0.8,
        timestamp: new Date()
      };

      // Simulated analysis logic
      // In a real implementation, you would analyze the frameData
      const frameSize = Buffer.from(data.frameData, 'base64').length;
      
      // Simulate different scenarios based on frame characteristics
      if (frameSize < 1000) {
        // Very small frame - might indicate no face or poor quality
        result.hasNoFace = true;
        result.confidence = 0.6;
      } else if (frameSize > 50000) {
        // Very large frame - might indicate multiple objects/faces
        result.hasMultipleFaces = true;
        result.confidence = 0.7;
      }

      // Store analysis result
      if (!this.analysisResults.has(data.userId)) {
        this.analysisResults.set(data.userId, []);
      }
      this.analysisResults.get(data.userId)!.push(result);

      // Keep only recent results (last 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      this.analysisResults.set(
        data.userId,
        this.analysisResults.get(data.userId)!.filter(r => r.timestamp > tenMinutesAgo)
      );

      return result;
    } catch (error) {
      logger.error('Video analysis error:', error);
      return {
        hasMultipleFaces: false,
        hasNoFace: false,
        hasUnusualMovement: false,
        confidence: 0,
        timestamp: new Date()
      };
    }
  }

  // Check for suspicious patterns in recent analysis results
  static async checkForSuspiciousActivity(userId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    confidence: number;
  }> {
    try {
      const results = this.analysisResults.get(userId) || [];
      if (results.length === 0) {
        return { isSuspicious: false, reasons: [], confidence: 0 };
      }

      const reasons: string[] = [];
      let confidence = 0;

      // Check for multiple faces
      const multipleFacesCount = results.filter(r => r.hasMultipleFaces).length;
      if (multipleFacesCount > results.length * 0.3) { // 30% of frames have multiple faces
        reasons.push('Multiple faces detected');
        confidence += 0.4;
      }

      // Check for no face detection
      const noFaceCount = results.filter(r => r.hasNoFace).length;
      if (noFaceCount > results.length * 0.5) { // 50% of frames have no face
        reasons.push('No face detected for extended period');
        confidence += 0.3;
      }

      // Check for unusual movement patterns
      const unusualMovementCount = results.filter(r => r.hasUnusualMovement).length;
      if (unusualMovementCount > results.length * 0.4) { // 40% of frames show unusual movement
        reasons.push('Unusual movement patterns detected');
        confidence += 0.3;
      }

      return {
        isSuspicious: reasons.length > 0,
        reasons,
        confidence: Math.min(confidence, 1.0)
      };
    } catch (error) {
      logger.error('Suspicious activity check error:', error);
      return { isSuspicious: false, reasons: [], confidence: 0 };
    }
  }

  // Automated warning system
  static async processAutomatedWarning(exam: IExam, userId: string): Promise<boolean> {
    try {
      const suspiciousActivity = await this.checkForSuspiciousActivity(userId);
      
      if (suspiciousActivity.isSuspicious && suspiciousActivity.confidence > 0.6) {
        const reason = suspiciousActivity.reasons.join(', ');
        await this.issueWarning(exam, userId, `Automated detection: ${reason}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Automated warning processing error:', error);
      return false;
    }
  }

  static async handleDisconnection(exam: IExam, userId: string, reason?: string): Promise<void> {
    try {
      const candidate = exam.candidates.find((c: { user: any; }) => String(c.user) === String(userId));
      if (!candidate) return;

      // Record disconnection
      exam.recordDisconnection(userId, reason);

      // Check if max disconnections reached
      const recentDisconnections = candidate.videoMonitoring.disconnections.filter((d: { startTime: { getTime: () => number; }; }) => {
        const disconnectionTime = d.startTime.getTime();
        return Date.now() - disconnectionTime <= VIDEO_CONSTANTS.RECONNECTION_TIMEOUT;
      });

      if (recentDisconnections.length >= VIDEO_CONSTANTS.MAX_DISCONNECTIONS) {
        candidate.status = 'disqualified';
        logger.warn(`Candidate ${userId} disqualified due to too many disconnections in exam ${exam._id}`);
      }

      await exam.save();
    } catch (error) {
      logger.error('Error handling video disconnection:', error);
    }
  }

  static async handleReconnection(exam: IExam, userId: string): Promise<void> {
    try {
      exam.recordReconnection(userId);
      await exam.save();
    } catch (error) {
      logger.error('Error handling video reconnection:', error);
    }
  }

  static async issueWarning(exam: IExam, userId: string, reason: string): Promise<void> {
    try {
      if (!this.canIssueWarning(userId)) return;

      exam.recordWarning(userId, reason);
      this.warningCooldowns.set(userId, new Date());
      await exam.save();

      logger.warn(`Warning issued to candidate ${userId} in exam ${exam._id}: ${reason}`);
    } catch (error) {
      logger.error('Error issuing warning:', error);
    }
  }

  static clearWarningCooldown(userId: string): void {
    this.warningCooldowns.delete(userId);
  }

  // Clean up analysis data for a user
  static clearAnalysisData(userId: string): void {
    this.analysisResults.delete(userId);
  }
} 