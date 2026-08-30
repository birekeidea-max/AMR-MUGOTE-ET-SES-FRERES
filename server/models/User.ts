import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  firestoreId?: string;
  uid: string;
  email?: string;
  displayName?: string;
  phone?: string;
  photoURL?: string;
  role: 'CLIENT' | 'ADMIN' | 'STAFF';
  isVerified: boolean;
  totalBookings: number;
  totalSpent: number;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  firestoreId: { type: String, index: true },
  uid: { type: String, required: true, unique: true, index: true },
  email: { type: String, index: true, default: '' },
  displayName: { type: String, default: '' },
  phone: { type: String, default: '' },
  photoURL: { type: String, default: '' },
  role: { type: String, enum: ['CLIENT', 'ADMIN', 'STAFF'], default: 'CLIENT', index: true },
  isVerified: { type: Boolean, default: false },
  totalBookings: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastLogin: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'users'
});

UserSchema.index({ email: 1, role: 1 });
UserSchema.index({ lastLogin: -1 });

export const User: mongoose.Model<IUser> = 
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
