import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  encry_password: string;
  salt: string;
  type: 'superadmin' | 'admin' | 'candidate';
  education: string;
  college: string;
  university: string;
  department: string;
  course: string;
  designation: string;
  upcomingExams: mongoose.Types.ObjectId[];
  pastExams: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  isApproved: boolean;
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
      values: ['superadmin', 'admin', 'candidate'],
      message: '{VALUE} is not a valid user type'
    },
    required: [true, 'User type is required']
  },
  isApproved: {
    type: Boolean,
    default: function(this: any) { return this.type !== 'admin'; },
  },
  education: {
    type: String,
    required: function(this: any) { return this.type === 'candidate'; },
    trim: true
  },
  college: {
    type: String,
    required: function(this: any) { return this.type === 'candidate' || this.type === 'admin'; },
    trim: true
  },
  university: {
    type: String,
    required: function(this: any) { return this.type === 'candidate' || this.type === 'admin'; },
    trim: true
  },
  department: {
    type: String,
    required: function(this: any) { return this.type === 'candidate' || this.type === 'admin'; },
    trim: true
  },
  course: {
    type: String,
    required: function(this: any) { return this.type === 'candidate'; },
    trim: true
  },
  designation: {
    type: String,
    required: function(this: any) { return this.type === 'admin'; },
    trim: true
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
      const { encry_password, salt, ...rest } = ret;
      return rest;
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