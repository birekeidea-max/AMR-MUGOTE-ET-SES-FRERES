import mongoose, { Schema, Document } from 'mongoose';

export interface ISchedule extends Document {
  firestoreId?: string;
  from?: string;
  to?: string;
  time?: string;
  departureTime?: string;
  itinerary?: string;
  frequency?: string;
  ship?: string;
  days?: any;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleSchema = new Schema<ISchedule>({
  firestoreId: { type: String, index: true },
  from: { type: String, default: 'Bukavu' },
  to: { type: String, default: 'Goma' },
  time: { type: String, default: '07h30' },
  departureTime: { type: String, default: '07h30' },
  itinerary: { type: String, default: 'Bukavu-Goma' },
  frequency: { type: String, default: 'Quotidien' },
  ship: { type: String, default: 'Mugote 1' },
  days: { type: Schema.Types.Mixed, default: 'Tous les jours' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'schedules',
  strict: false
});

ScheduleSchema.index({ itinerary: 1, departureTime: 1 });
ScheduleSchema.index({ from: 1, to: 1, time: 1 });

export const Schedule: mongoose.Model<ISchedule> = 
  mongoose.models.Schedule || mongoose.model<ISchedule>('Schedule', ScheduleSchema);

