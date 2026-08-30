import mongoose, { Schema, Document } from 'mongoose';

export interface IBoat extends Document {
  firestoreId?: string;
  name: string;
  capacity: number;
  description?: string;
  imageUrl?: string;
  gallery?: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const BoatSchema = new Schema<IBoat>({
  firestoreId: { type: String, index: true },
  name: { type: String, required: true },
  capacity: { type: Number, required: true, default: 120 },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  gallery: [{ type: String }],
  status: { type: String, default: 'ACTIF' }
}, {
  timestamps: true,
  collection: 'fleet'
});

BoatSchema.index({ name: 1 });

export const Boat: mongoose.Model<IBoat> = 
  mongoose.models.Boat || mongoose.model<IBoat>('Boat', BoatSchema);
