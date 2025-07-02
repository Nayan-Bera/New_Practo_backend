import mongoose, { Schema, Document } from 'mongoose';

export interface IAnswer extends Document {
  questionId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  selectedOption: number;
  timeSpent: number;
}

const answerSchema = new Schema<IAnswer>({
  questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  selectedOption: { type: Number, required: true },
  timeSpent: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model<IAnswer>('Answer', answerSchema);
