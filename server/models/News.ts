import mongoose, { Schema, Document } from 'mongoose';

export interface INews extends Document {
  firestoreId?: string;
  title: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  media?: string[];
  author?: string;
  views: number;
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NewsSchema = new Schema<INews>({
  firestoreId: { type: String, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  media: [{ type: String }],
  author: { type: String, default: 'Direction AMR Mugote' },
  views: { type: Number, default: 0 },
  publishedAt: { type: Date, default: Date.now, index: true },
}, {
  timestamps: true,
  collection: 'news'
});

NewsSchema.index({ publishedAt: -1 });

export const News: mongoose.Model<INews> = 
  mongoose.models.News || mongoose.model<INews>('News', NewsSchema);
