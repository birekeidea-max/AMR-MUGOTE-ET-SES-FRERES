import mongoose, { Schema, Document } from 'mongoose';

export interface IReservation extends Document {
  firestoreId?: string;
  ticketId?: string;
  fullName: string;
  lastName?: string;
  phone: string;
  email?: string;
  itinerary: 'Bukavu-Goma' | 'Goma-Bukavu' | string;
  ship: string;
  travelDate: string;
  departureTime?: string;
  travelClass: 'VIP' | '1ère Classe' | '2ème Classe' | '3ème Classe' | string;
  passengersCount: number;
  passengersList?: Array<{ fullName: string; phone?: string; travelClass?: string }>;
  status: 'PENDING' | 'VALIDATED' | 'REJECTED' | 'CANCELLED';
  paymentMethod?: string;
  transactionId?: string;
  trackingRef?: string;
  amount: number;
  currency?: string;
  userId?: string;
  notes?: string;
  usedAt?: Date;
  isUsed?: boolean;
  validatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReservationSchema = new Schema<IReservation>({
  firestoreId: { type: String, index: true },
  ticketId: { type: String, index: true, sparse: true },
  fullName: { type: String, default: 'Passager' },
  lastName: { type: String, default: '' },
  phone: { type: String, default: 'N/A', index: true },
  email: { type: String, index: true, default: '' },
  itinerary: { type: String, default: 'Bukavu-Goma' },
  ship: { type: String, default: 'Mugote 1' },
  travelDate: { type: String, default: () => new Date().toISOString().split('T')[0], index: true },
  departureTime: { type: String, default: '07h30' },
  travelClass: { type: String, default: '2ème Classe' },
  passengersCount: { type: Number, default: 1, min: 1 },
  passengersList: [{
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    travelClass: { type: String, default: '' }
  }],
  status: { 
    type: String, 
    default: 'PENDING',
    index: true 
  },
  paymentMethod: { type: String, default: 'Mobile Money' },
  transactionId: { type: String, index: true, default: '' },
  trackingRef: { type: String, index: true, default: '' },
  amount: { type: Number, default: 20 },
  currency: { type: String, default: 'USD' },
  userId: { type: String, index: true, default: '' },
  notes: { type: String, default: '' },
  isUsed: { type: Boolean, default: false },
  usedAt: { type: Date },
  validatedAt: { type: Date }
}, {
  timestamps: true,
  collection: 'reservations'
});

// Compound indexes for rapid lookup
ReservationSchema.index({ phone: 1, travelDate: -1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ status: 1, travelDate: -1 });
ReservationSchema.index({ ticketId: 1, status: 1 });

export const Reservation: mongoose.Model<IReservation> = 
  mongoose.models.Reservation || mongoose.model<IReservation>('Reservation', ReservationSchema);
