import mongoose, { Schema } from 'mongoose';
import { IExam, ICandidate, IQuestion, IAnswer } from '../../interfaces/IExam';

// Embedded question schema
const questionSchema = new Schema<IQuestion>({
  _id: { type: Schema.Types.ObjectId, auto: true },
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
  marks: { type: Number, required: true, default: 1 }
}, { _id: true });

// Embedded answer schema
const answerSchema = new Schema<IAnswer>({
  _id: { type: Schema.Types.ObjectId, auto: true },
  questionId: { type: Schema.Types.ObjectId, required: true },
  candidateId: { type: Schema.Types.ObjectId, required: true },
  selectedOption: { type: Number, required: true },
  timeSpent: { type: Number, required: true }
}, { _id: true });

// Embedded candidate schema
const candidateSchema = new Schema<ICandidate>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'ongoing', 'completed', 'disqualified'],
    default: 'pending'
  },
  joinTime: Date,
  submitTime: Date,
  score: Number,
  warnings: { type: Number, default: 0 },
  videoMonitoring: {
    isEnabled: { type: Boolean, default: true },
    warningCount: { type: Number, default: 0 },
    lastWarningTime: Date,
    disconnections: [{
      startTime: { type: Date, required: true },
      endTime: Date,
      reason: String
    }]
  }
});

const examSchema = new Schema<IExam>({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, required: true },
  duration: { type: Number, required: true, min: 5, max: 180 },
  questions: [questionSchema],
  candidates: [candidateSchema],
  answers: [answerSchema],
  settings: { type: Map, of: Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  }
}, { timestamps: true });

// Instance methods
examSchema.methods.addCandidate = function(userId: string) {
  const candidate: ICandidate = {
    user: new mongoose.Types.ObjectId(userId),
    status: 'pending',
    warnings: 0,
    videoMonitoring: {
      isEnabled: true,
      warningCount: 0,
      disconnections: []
    }
  };
  
  this.candidates.push(candidate);
  return this;
};

examSchema.methods.recordWarning = function(userId: string, _reason?: string) {
  const candidate = this.candidates.find((c: ICandidate) => 
    c.user.toString() === userId
  );
  
  if (candidate) {
    candidate.warnings++;
    candidate.videoMonitoring.warningCount++;
    candidate.videoMonitoring.lastWarningTime = new Date();
  }
  
  return this;
};

examSchema.methods.recordDisconnection = function(userId: string, reason?: string) {
  const candidate = this.candidates.find((c: ICandidate) => 
    c.user.toString() === userId
  );
  
  if (candidate) {
    const disconnection = {
      startTime: new Date(),
      reason: reason || 'Unknown disconnection'
    };
    
    candidate.videoMonitoring.disconnections.push(disconnection);
  }
  
  return this;
};

examSchema.methods.recordReconnection = function(userId: string) {
  const candidate = this.candidates.find((c: ICandidate) => 
    c.user.toString() === userId
  );
  
  if (candidate && candidate.videoMonitoring.disconnections.length > 0) {
    const lastDisconnection = candidate.videoMonitoring.disconnections[
      candidate.videoMonitoring.disconnections.length - 1
    ];
    lastDisconnection.endTime = new Date();
  }
  
  return this;
};

// Indexes
examSchema.index({ startTime: 1, status: 1 });
examSchema.index({ host: 1 });
examSchema.index({ 'candidates.user': 1 });

export default mongoose.model<IExam>('Exam', examSchema);
