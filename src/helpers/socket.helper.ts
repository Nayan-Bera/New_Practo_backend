import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { ERROR_MESSAGES } from '../constants';
import Exam from '../db/models/exam.model';
import User from '../db/models/user.model';
import logger from '../utils/logger';
import { IExam } from '../interfaces/IExam';
import { VideoMonitoringService, IVideoAnalysisData } from './video.helper';

interface ISocketUser {
  _id: string;
  type: 'admin' | 'candidate';
}

interface IVideoEvent {
  examId: string;
  userId: string;
  stream?: MediaStream;
  reason?: string;
}

interface IVideoMonitoringState {
  isStreaming: boolean;
  lastWarningTime?: Date;
  warningCount: number;
}

interface IReconnectionAttempt {
  attempts: number;
  lastAttempt: Date;
  examId: string;
}

export class SocketService {
  private io: Server;
  private examRooms: Map<string, Set<string>> = new Map();
  private videoStates: Map<string, IVideoMonitoringState> = new Map(); // userId -> state
  private reconnectionAttempts: Map<string, IReconnectionAttempt> = new Map();
  private readonly MAX_RECONNECTION_ATTEMPTS = 3;
  private readonly RECONNECTION_TIMEOUT = 30000; // 30 seconds
  private analysisIntervals: Map<string, NodeJS.Timeout> = new Map(); // userId -> interval

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error(ERROR_MESSAGES.AUTH.UNAUTHORIZED));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { _id: string };
        const user = await User.findById(decoded._id);

        if (!user) {
          return next(new Error(ERROR_MESSAGES.AUTH.USER_NOT_FOUND));
        }

        socket.data.user = {
          _id: user._id,
          type: user.type
        };

        next();
      } catch (error) {
        next(new Error(ERROR_MESSAGES.AUTH.TOKEN_INVALID));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`User connected: ${socket.data.user._id}`);

      // New authenticated events
      socket.on('joinExam', this.handleJoinExam(socket));
      socket.on('leaveExam', this.handleLeaveExam(socket));
      socket.on('startStream', this.handleStartStream(socket));
      socket.on('stopStream', this.handleStopStream(socket));
      socket.on('sendWarning', this.handleSendWarning(socket));
      socket.on('disconnect', this.handleDisconnect(socket));
      socket.on('reconnect', this.handleReconnect(socket));

      // Video analysis events
      socket.on('analyzeFrame', this.handleAnalyzeFrame(socket));
      socket.on('startAutomatedMonitoring', this.handleStartAutomatedMonitoring(socket));
      socket.on('stopAutomatedMonitoring', this.handleStopAutomatedMonitoring(socket));

      // Legacy events for frontend compatibility
      socket.on('join_room', this.handleJoinRoom(socket));
      socket.on('new_join', this.handleNewJoin(socket));
      socket.on('sending_signal', this.handleSendingSignal(socket));
      socket.on('send_signal', this.handleSendSignal(socket));
      socket.on('send_warning', this.handleSendWarningLegacy(socket));
      socket.on('leaveExam', this.handleLeaveExamLegacy(socket));
    });
  }

  private handleJoinExam(socket: Socket) {
    return async ({ examId }: { examId: string }) => {
      try {
        const exam = await Exam.findById(examId) as IExam;
        if (!exam) {
          socket.emit('error', { message: ERROR_MESSAGES.EXAM.NOT_FOUND });
          return;
        }

        const user = socket.data.user as ISocketUser;
        const isAdmin = String(exam.admin) === String(user._id);
        const isCandidate = exam.candidates.some(c => String(c.user) === String(user._id));

        if (!isAdmin && !isCandidate) {
          socket.emit('error', { message: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED });
          return;
        }

        socket.join(examId);
        if (!this.examRooms.has(examId)) {
          this.examRooms.set(examId, new Set());
        }
        this.examRooms.get(examId)?.add(socket.id);

        // Initialize video state for candidate
        if (isCandidate) {
          this.videoStates.set(user._id, {
            isStreaming: false,
            warningCount: 0
          });
        }

        socket.emit('joinedExam', { examId });
        this.io.to(examId).emit('userJoined', { 
          userId: user._id, 
          type: user.type,
          videoState: isCandidate ? this.videoStates.get(user._id) : undefined
        });

        // Emit user_list to admin for monitoring dashboard
        if (isAdmin) {
          this.emitUserListToAdmin(examId, user._id);
        }
      } catch (error) {
        logger.error('Join exam error:', error);
        socket.emit('error', { message: 'Failed to join exam' });
      }
    };
  }

  // Helper method to emit user_list to admin
  private emitUserListToAdmin(examId: string, adminId: string): void {
    const exam = this.examRooms.get(examId);
    if (!exam) return;

    const candidates = Array.from(exam).map(socketId => {
      // Find user data for this socket
      const userData = this.getUserDataBySocketId(socketId);
      if (userData && userData.type === 'candidate') {
        return {
          socketid: socketId,
          user: { _id: userData._id, type: userData.type }
        };
      }
      return null;
    }).filter(Boolean);

    // Emit to admin
    this.io.to(adminId).emit('user_list', candidates);
  }

  // Helper method to get user data by socket ID
  private getUserDataBySocketId(socketId: string): ISocketUser | null {
    // This is a simplified implementation - in a real app, you'd maintain a mapping
    // For now, we'll use the socket data if available
    const socket = this.io.sockets.sockets.get(socketId);
    return socket?.data?.user || null;
  }

  private handleLeaveExam(socket: Socket) {
    return async ({ examId }: { examId: string }) => {
      try {
        const user = socket.data.user as ISocketUser;
        const exam = await Exam.findById(examId) as IExam;
        const isAdmin = exam ? String(exam.admin) === String(user._id) : false;
        
        socket.leave(examId);
        this.examRooms.get(examId)?.delete(socket.id);
        this.videoStates.delete(user._id);
        this.io.to(examId).emit('userLeft', { userId: user._id });

        // Emit updated user_list to admin if a candidate left
        if (!isAdmin && exam) {
          this.emitUserListToAdmin(examId, exam.admin.toString());
        }
      } catch (error) {
        logger.error('Leave exam error:', error);
      }
    };
  }

  private handleStartStream(socket: Socket) {
    return async ({ examId, stream }: IVideoEvent) => {
      try {
        const user = socket.data.user as ISocketUser;
        if (user.type !== 'candidate') {
          socket.emit('error', { message: 'Only candidates can stream' });
          return;
        }

        const exam = await Exam.findById(examId) as IExam;
        if (!exam) {
          socket.emit('error', { message: ERROR_MESSAGES.EXAM.NOT_FOUND });
          return;
        }

        const candidate = exam.candidates.find(c => String(c.user) === String(user._id));
        if (!candidate) {
          socket.emit('error', { message: 'Candidate not found in exam' });
          return;
        }

        if (!candidate.videoMonitoring.isEnabled) {
          socket.emit('error', { message: 'Video monitoring is disabled' });
          return;
        }

        // Update video state
        const videoState = this.videoStates.get(user._id) || {
          isStreaming: true,
          warningCount: 0
        };
        videoState.isStreaming = true;
        this.videoStates.set(user._id, videoState);

        this.io.to(examId).emit('streamStarted', {
          userId: user._id,
          stream,
          videoState
        });
      } catch (error) {
        logger.error('Start stream error:', error);
        socket.emit('error', { message: 'Failed to start stream' });
      }
    };
  }

  private handleStopStream(socket: Socket) {
    return async ({ examId, reason }: IVideoEvent) => {
      try {
        const user = socket.data.user as ISocketUser;
        const exam = await Exam.findById(examId) as IExam;
        if (exam) {
          exam.recordDisconnection(user._id, reason);
          await exam.save();

          // Update video state
          const videoState = this.videoStates.get(user._id);
          if (videoState) {
            videoState.isStreaming = false;
            this.videoStates.set(user._id, videoState);
          }
        }

        this.io.to(examId).emit('streamStopped', {
          userId: user._id,
          reason,
          videoState: this.videoStates.get(user._id)
        });
      } catch (error) {
        logger.error('Stop stream error:', error);
      }
    };
  }

  private handleSendWarning(socket: Socket) {
    return async ({ examId, userId, message }: { examId: string; userId: string; message: string }) => {
      try {
        const sender = socket.data.user as ISocketUser;
        const exam = await Exam.findById(examId) as IExam;
        
        if (!exam || String(exam.admin) !== String(sender._id)) {
          socket.emit('error', { message: 'Not authorized to send warnings' });
          return;
        }

        const videoState = this.videoStates.get(userId);
        if (videoState) {
          videoState.warningCount++;
          videoState.lastWarningTime = new Date();
          this.videoStates.set(userId, videoState);

          // Record warning in exam
          exam.recordWarning(userId, message);
          await exam.save();

          // Emit warning to candidate and all monitors
          this.io.to(examId).emit('warningIssued', {
            userId,
            message,
            videoState
          });

          // Check if max warnings reached
          const maxWarnings = exam.settings?.maxWarnings ?? 3; // Default to 3 if not set
          const shouldAutoDisqualify = exam.settings?.autoDisqualifyOnMaxWarnings ?? true; // Default to true

          if (shouldAutoDisqualify && videoState.warningCount >= maxWarnings) {
            const candidate = exam.candidates.find(c => String(c.user) === userId);
            if (candidate) {
              candidate.status = 'disqualified';
              await exam.save();
              this.io.to(examId).emit('candidateDisqualified', { userId });
            }
          }
        }
      } catch (error) {
        logger.error('Send warning error:', error);
      }
    };
  }

  private handleDisconnect(socket: Socket) {
    return async (reason: string) => {
      try {
        const user = socket.data.user as ISocketUser;
        const userId = user._id;

        // Clean up analysis intervals and data
        if (this.analysisIntervals.has(userId)) {
          clearInterval(this.analysisIntervals.get(userId)!);
          this.analysisIntervals.delete(userId);
        }
        VideoMonitoringService.clearAnalysisData(userId);

        // Find which exam room the user was in
        const examId = Array.from(this.examRooms.entries())
          .find(([_, sockets]) => sockets.has(socket.id))?.[0];

        if (examId) {
          const exam = await Exam.findById(examId) as IExam;
          if (exam) {
            // Record disconnection
            await VideoMonitoringService.handleDisconnection(exam, userId, reason);

            // Remove from room
            this.examRooms.get(examId)?.delete(socket.id);
            this.videoStates.delete(userId);

            // Notify room about disconnection
            this.io.to(examId).emit('userDisconnected', {
              userId,
              reason,
              timestamp: new Date()
            });

            // Emit updated user_list to admin
            const isAdmin = String(exam.admin) === String(userId);
            if (!isAdmin) {
              this.emitUserListToAdmin(examId, exam.admin.toString());
            }
          }
        }

        // Handle reconnection attempts with proper limits
        const reconnectInfo = this.reconnectionAttempts.get(userId);
        if (reconnectInfo && reason === 'transport close') {
          const timeSinceLastAttempt = Date.now() - reconnectInfo.lastAttempt.getTime();
          
          // Reset attempts if too much time has passed
          if (timeSinceLastAttempt > this.RECONNECTION_TIMEOUT * 2) {
            reconnectInfo.attempts = 0;
          }
          
          if (reconnectInfo.attempts < this.MAX_RECONNECTION_ATTEMPTS) {
            reconnectInfo.attempts++;
            reconnectInfo.lastAttempt = new Date();
            this.reconnectionAttempts.set(userId, reconnectInfo);

            // Schedule cleanup if no reconnection happens within timeout
            setTimeout(() => {
              const currentInfo = this.reconnectionAttempts.get(userId);
              if (currentInfo && currentInfo.attempts >= this.MAX_RECONNECTION_ATTEMPTS) {
                this.reconnectionAttempts.delete(userId);
                logger.warn(`User ${userId} exceeded reconnection attempts`);
                
                // Notify about permanent disconnection
                if (examId) {
                  this.io.to(examId).emit('userDisconnected', {
                    userId,
                    reason: 'Maximum reconnection attempts exceeded',
                    permanent: true,
                    timestamp: new Date()
                  });
                }
              }
            }, this.RECONNECTION_TIMEOUT);
          } else {
            // Max attempts exceeded - clean up
            this.reconnectionAttempts.delete(userId);
            logger.warn(`User ${userId} exceeded reconnection attempts`);
            
            // Notify about permanent disconnection
            if (examId) {
              this.io.to(examId).emit('userDisconnected', {
                userId,
                reason: 'Maximum reconnection attempts exceeded',
                permanent: true,
                timestamp: new Date()
              });
            }
          }
        }
      } catch (error) {
        logger.error('Disconnect error:', error);
      }
    };
  }

  private handleReconnect(socket: Socket) {
    return async ({ examId }: { examId: string }) => {
      try {
        const user = socket.data.user as ISocketUser;
        const userId = user._id;
        const reconnectInfo = this.reconnectionAttempts.get(userId);

        if (!reconnectInfo || reconnectInfo.examId !== examId) {
          socket.emit('error', { message: 'Invalid reconnection attempt' });
          return;
        }

        // Reset reconnection state on successful reconnect
        this.reconnectionAttempts.delete(userId);

        const exam = await Exam.findById(examId) as IExam;
        if (!exam) {
          socket.emit('error', { message: ERROR_MESSAGES.EXAM.NOT_FOUND });
          return;
        }

        // Record successful reconnection
        exam.recordReconnection(userId);
        await exam.save();

        // Rejoin room
        socket.join(examId);
        if (!this.examRooms.has(examId)) {
          this.examRooms.set(examId, new Set());
        }
        this.examRooms.get(examId)?.add(socket.id);

        // Notify room about successful reconnection
        this.io.to(examId).emit('userReconnected', {
          userId,
          videoState: this.videoStates.get(userId)
        });
      } catch (error) {
        logger.error('Reconnect error:', error);
        socket.emit('error', { message: 'Failed to reconnect' });
      }
    };
  }

  // Legacy event handlers for frontend compatibility
  private handleJoinRoom(socket: Socket) {
    return async (payload: { examid: string; user: { _id: string; type: string } }) => {
      try {
        const exam = await Exam.findById(payload.examid) as IExam;
        if (!exam) {
          socket.emit('error', { message: ERROR_MESSAGES.EXAM.NOT_FOUND });
          return;
        }

        const user = socket.data.user as ISocketUser;
        const isAdmin = String(exam.admin) === String(user._id);
        const isCandidate = exam.candidates.some(c => String(c.user) === String(user._id));

        if (!isAdmin && !isCandidate) {
          socket.emit('error', { message: ERROR_MESSAGES.EXAM.NOT_AUTHORIZED });
          return;
        }

        socket.join(payload.examid);
        if (!this.examRooms.has(payload.examid)) {
          this.examRooms.set(payload.examid, new Set());
        }
        this.examRooms.get(payload.examid)?.add(socket.id);

        // Initialize video state for candidate
        if (isCandidate) {
          this.videoStates.set(user._id, {
            isStreaming: false,
            warningCount: 0
          });
        }

        // Emit user_list to admin (legacy behavior)
        if (isAdmin) {
          const candidates = exam.candidates.filter(c => c.user.toString() !== user._id);
          socket.emit('user_list', candidates.map(c => ({
            socketid: c.user.toString(),
            user: { _id: c.user.toString(), type: 'candidate' }
          })));
        }

        socket.emit('joinedExam', { examId: payload.examid });
      } catch (error) {
        logger.error('Join room error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    };
  }

  private handleNewJoin(socket: Socket) {
    return async () => {
      try {
        const user = socket.data.user as ISocketUser;
        const examId = Array.from(this.examRooms.entries())
          .find(([_, sockets]) => sockets.has(socket.id))?.[0];

        if (examId) {
          this.io.to(examId).emit('user_joined', {
            socketid: socket.id,
            user: { _id: user._id, type: user.type }
          });
        }
      } catch (error) {
        logger.error('New join error:', error);
      }
    };
  }

  private handleSendingSignal(socket: Socket) {
    return async (payload: { signal: { type: string; sdp?: string; candidate?: RTCIceCandidate }; to: string; from: string }) => {
      try {
        socket.to(payload.to).emit('receive_signal', {
          signal: payload.signal,
          from: payload.from
        });
      } catch (error) {
        logger.error('Sending signal error:', error);
      }
    };
  }

  private handleSendSignal(socket: Socket) {
    return async (payload: { signal: { type: string; sdp?: string; candidate?: RTCIceCandidate }; to: string }) => {
      try {
        socket.to(payload.to).emit('receiving_returned_signal', {
          signal: payload.signal,
          from: socket.id
        });
      } catch (error) {
        logger.error('Send signal error:', error);
      }
    };
  }

  private handleSendWarningLegacy(socket: Socket) {
    return async (payload: { to: string; message: string }) => {
      try {
        const sender = socket.data.user as ISocketUser;
        const examId = Array.from(this.examRooms.entries())
          .find(([_, sockets]) => sockets.has(socket.id))?.[0];

        if (!examId) {
          socket.emit('error', { message: 'Not in any exam room' });
          return;
        }

        const exam = await Exam.findById(examId) as IExam;
        if (!exam || String(exam.admin) !== String(sender._id)) {
          socket.emit('error', { message: 'Not authorized to send warnings' });
          return;
        }

        // Find candidate by socket ID
        const candidateSocket = Array.from(this.examRooms.get(examId) || [])
          .find(socketId => socketId === payload.to);

        if (candidateSocket) {
          const videoState = this.videoStates.get(sender._id);
          if (videoState) {
            videoState.warningCount++;
            videoState.lastWarningTime = new Date();
            this.videoStates.set(sender._id, videoState);

            // Record warning in exam
            exam.recordWarning(sender._id, payload.message);
            await exam.save();

            // Send warning to candidate
            this.io.to(payload.to).emit('warning_received', {
              message: payload.message,
              warningCount: videoState.warningCount
            });
          }
        }
      } catch (error) {
        logger.error('Send warning legacy error:', error);
      }
    };
  }

  private handleLeaveExamLegacy(socket: Socket) {
    return async (payload: { examId: string }) => {
      try {
        const user = socket.data.user as ISocketUser;
        socket.leave(payload.examId);
        this.examRooms.get(payload.examId)?.delete(socket.id);
        this.videoStates.delete(user._id);
        this.io.to(payload.examId).emit('user_left', { userId: user._id });
      } catch (error) {
        logger.error('Leave exam legacy error:', error);
      }
    };
  }

  // Video analysis event handlers
  private handleAnalyzeFrame(socket: Socket) {
    return async (data: IVideoAnalysisData) => {
      try {
        const user = socket.data.user as ISocketUser;
        if (user.type !== 'candidate') {
          socket.emit('error', { message: 'Only candidates can send video frames' });
          return;
        }

        // Analyze the video frame
        const analysisResult = await VideoMonitoringService.analyzeVideoFrame(data);
        
        // Check for suspicious activity
        const suspiciousActivity = await VideoMonitoringService.checkForSuspiciousActivity(user._id);
        
        if (suspiciousActivity.isSuspicious) {
          // Notify admin about suspicious activity
          const exam = await Exam.findById(data.examId) as IExam;
          if (exam) {
            this.io.to(data.examId).emit('suspiciousActivityDetected', {
              userId: user._id,
              reasons: suspiciousActivity.reasons,
              confidence: suspiciousActivity.confidence,
              timestamp: new Date()
            });
          }
        }

        // Send analysis result back to client
        socket.emit('frameAnalysisResult', {
          result: analysisResult,
          suspiciousActivity
        });
      } catch (error) {
        logger.error('Frame analysis error:', error);
        socket.emit('error', { message: 'Failed to analyze video frame' });
      }
    };
  }

  private handleStartAutomatedMonitoring(socket: Socket) {
    return async ({ examId }: { examId: string }) => {
      try {
        const user = socket.data.user as ISocketUser;
        if (user.type !== 'candidate') {
          socket.emit('error', { message: 'Only candidates can start automated monitoring' });
          return;
        }

        // Clear any existing interval
        if (this.analysisIntervals.has(user._id)) {
          clearInterval(this.analysisIntervals.get(user._id)!);
        }

        // Start periodic suspicious activity checks
        const interval = setInterval(async () => {
          try {
            const exam = await Exam.findById(examId) as IExam;
            if (exam) {
              const warningIssued = await VideoMonitoringService.processAutomatedWarning(exam, user._id);
              if (warningIssued) {
                this.io.to(examId).emit('automatedWarningIssued', {
                  userId: user._id,
                  timestamp: new Date()
                });
              }
            }
          } catch (error) {
            logger.error('Automated monitoring check error:', error);
          }
        }, 30000); // Check every 30 seconds

        this.analysisIntervals.set(user._id, interval);
        socket.emit('automatedMonitoringStarted', { examId });
      } catch (error) {
        logger.error('Start automated monitoring error:', error);
        socket.emit('error', { message: 'Failed to start automated monitoring' });
      }
    };
  }

  private handleStopAutomatedMonitoring(socket: Socket) {
    return async () => {
      try {
        const user = socket.data.user as ISocketUser;
        
        // Clear the interval
        if (this.analysisIntervals.has(user._id)) {
          clearInterval(this.analysisIntervals.get(user._id)!);
          this.analysisIntervals.delete(user._id);
        }

        // Clear analysis data
        VideoMonitoringService.clearAnalysisData(user._id);
        
        socket.emit('automatedMonitoringStopped');
      } catch (error) {
        logger.error('Stop automated monitoring error:', error);
        socket.emit('error', { message: 'Failed to stop automated monitoring' });
      }
    };
  }
}

export default SocketService; 