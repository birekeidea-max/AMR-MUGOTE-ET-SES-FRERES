import mongoose, { Schema, Document } from 'mongoose';

export interface IAgendaNotification {
  type: 'CONFIRMATION' | 'REMINDER' | 'BOAT_ALERT' | 'SCHEDULE_CHANGE' | 'BOARDING_CALL';
  subject: string;
  message: string;
  sentAt: Date;
  success: boolean;
}

export interface IServerAgenda extends Document {
  email: string;
  fullName: string;
  phone?: string;
  ticketId: string;
  reservationId?: string;
  userId?: string;
  ship: string;
  itinerary: string;
  travelDate: string; // YYYY-MM-DD
  departureTime: string; // e.g. "07h30"
  boardingTime: string; // e.g. "06h45"
  travelClass: string;
  passengersCount: number;
  amount: number;
  status: 'SCHEDULED' | 'BOARDING' | 'SAILING' | 'COMPLETED' | 'CANCELLED';
  boatStatus: 'A_QUAI' | 'EMBARQUEMENT' | 'EN_ROUTE' | 'ARRIVE' | 'RETARD' | 'NORMAL';
  realtimeAlertsSubscribed: boolean;
  confirmationSent: boolean;
  confirmationSentAt?: Date;
  reminderSent: boolean;
  reminderSentAt?: Date;
  notificationsLog: IAgendaNotification[];
  createdAt: Date;
  updatedAt: Date;
}

const ServerAgendaSchema: Schema = new Schema({
  email: { type: String, required: true, index: true, lowercase: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  ticketId: { type: String, required: true, index: true },
  reservationId: { type: String, index: true },
  userId: { type: String, index: true },
  ship: { type: String, required: true, trim: true },
  itinerary: { type: String, required: true, trim: true },
  travelDate: { type: String, required: true, index: true },
  departureTime: { type: String, default: '07h30' },
  boardingTime: { type: String, default: '06h45' },
  travelClass: { type: String, default: '2ème Classe' },
  passengersCount: { type: Number, default: 1 },
  amount: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['SCHEDULED', 'BOARDING', 'SAILING', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED',
    index: true
  },
  boatStatus: {
    type: String,
    enum: ['A_QUAI', 'EMBARQUEMENT', 'EN_ROUTE', 'ARRIVE', 'RETARD', 'NORMAL'],
    default: 'NORMAL'
  },
  realtimeAlertsSubscribed: { type: Boolean, default: true },
  confirmationSent: { type: Boolean, default: false },
  confirmationSentAt: { type: Date },
  reminderSent: { type: Boolean, default: false },
  reminderSentAt: { type: Date },
  notificationsLog: [
    {
      type: { type: String, enum: ['CONFIRMATION', 'REMINDER', 'BOAT_ALERT', 'SCHEDULE_CHANGE', 'BOARDING_CALL'] },
      subject: { type: String },
      message: { type: String },
      sentAt: { type: Date, default: Date.now },
      success: { type: Boolean, default: true }
    }
  ]
}, {
  timestamps: true
});

ServerAgendaSchema.index({ travelDate: 1, ship: 1 });
ServerAgendaSchema.index({ email: 1, travelDate: 1 });

export const ServerAgenda: mongoose.Model<IServerAgenda> = 
  (mongoose.models.ServerAgenda as mongoose.Model<IServerAgenda>) || 
  mongoose.model<IServerAgenda>('ServerAgenda', ServerAgendaSchema);
export default ServerAgenda;
