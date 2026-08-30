import mongoose, { Schema, Document } from 'mongoose';

export interface ISchedule extends Document {
  firestoreId?: string;
  from: string;
  to: string;
  time: string;
  ship?: string;
  days?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleSchema = new Schema<ISchedule>({
  firestoreId: { type: String, index: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  time: { type: String, required: true },
  ship: { type: String, default: 'Mugote 1' },
  days: { type: String, default: 'Tous les jours' },
}, {
  timestamps: true,
  collection: 'schedules'
});

ScheduleSchema.index({ from: 1, to: 1, time: 1 });

export const Schedule: mongoose.Model<ISchedule> = 
  mongoose.models.Schedule || mongoose.model<ISchedule>('Schedule', ScheduleSchema);
