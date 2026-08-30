import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  firestoreId?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  lastMessage?: string;
  status: 'OPEN' | 'CLOSED';
  adminUnreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
  firestoreId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: 'Passager' },
  userEmail: { type: String, default: '' },
  lastMessage: { type: String, default: '' },
  status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN', index: true },
  adminUnreadCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'conversations'
});

ConversationSchema.index({ updatedAt: -1 });

export const Conversation: mongoose.Model<IConversation> = 
  mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);
