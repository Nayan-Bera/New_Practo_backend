import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion extends Document {
  examId: mongoose.Types.ObjectId;
  question: string;
  options: string[];
  correctAnswer: number;
  marks: number;
}

const questionSchema = new Schema<IQuestion>({
  examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true },
  marks: { type: Number, required: true, default: 1 }
}, { timestamps: true });

export default mongoose.model<IQuestion>('Question', questionSchema);
