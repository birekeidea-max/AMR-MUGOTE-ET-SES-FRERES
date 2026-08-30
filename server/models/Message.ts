import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  firestoreId?: string;
  conversationId: string;
  text: string;
  senderId?: string;
  senderRole: 'USER' | 'ADMIN' | 'AI';
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  firestoreId: { type: String, index: true },
  conversationId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  senderId: { type: String, default: '' },
  senderRole: { type: String, enum: ['USER', 'ADMIN', 'AI'], default: 'USER' },
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  collection: 'messages'
});

MessageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message: mongoose.Model<IMessage> = 
  mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
