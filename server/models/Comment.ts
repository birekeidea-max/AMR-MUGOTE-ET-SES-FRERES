import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  firestoreId?: string;
  newsId: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>({
  firestoreId: { type: String, index: true },
  newsId: { type: String, required: true, index: true },
  userId: { type: String, default: '' },
  userName: { type: String, required: true },
  userAvatar: { type: String, default: '' },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  collection: 'news_comments'
});

CommentSchema.index({ newsId: 1, createdAt: -1 });

export const Comment: mongoose.Model<IComment> = 
  mongoose.models.Comment || mongoose.model<IComment>('Comment', CommentSchema);
