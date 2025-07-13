import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  encry_password: string;
  salt: string;
  type: 'admin' | 'candidate';
  upcomingExams: mongoose.Types.ObjectId[];
  pastExams: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  authenticate(plainPassword: string): boolean;
  securePassword(plainPassword: string): string;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  encry_password: {
    type: String,
    required: [true, 'Password is required'],
    select: false
  },
  salt: {
    type: String,
    select: false
  },
  type: {
    type: String,
    enum: {
      values: ['admin', 'candidate'],
      message: '{VALUE} is not a valid user type'
    },
    required: [true, 'User type is required']
  },
  upcomingExams: [{
    type: Schema.Types.ObjectId,
    ref: 'Exam'
  }],
  pastExams: [{
    type: Schema.Types.ObjectId,
    ref: 'Exam'
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.encry_password;
      delete ret.salt;
      return ret;
    }
  }
});

userSchema.virtual('password').set(function(this: IUser, password: string) {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  this.salt = bcrypt.genSaltSync(10);
  this.encry_password = this.securePassword(password);
});

userSchema.methods = {
  authenticate: function(this: IUser, plainPassword: string): boolean {
    if (!this.encry_password || !plainPassword) return false;
    return bcrypt.compareSync(plainPassword, this.encry_password);
  },
  
  securePassword: function(this: IUser, plainPassword: string): string {
    if (!plainPassword) return '';
    try {
      return bcrypt.hashSync(plainPassword, this.salt);
    } catch (err) {
      return '';
    }
  }
};

export default mongoose.model<IUser>('User', userSchema); 