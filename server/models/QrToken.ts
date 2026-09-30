import mongoose, { Schema, Document, Model } from 'mongoose';

export type QrTokenStatus = 'PENDING' | 'USED' | 'EXPIRED' | 'REVOKED';

export interface IQrToken extends Document {
  /** Jeton opaque et signé présent dans le QR code */
  token: string;
  /** Signature cryptographique HMAC-SHA256 */
  signature: string;
  /** Identifiant unique aléatoire UUID v4 (Anti-prédiction) */
  nonce: string;
  /** Identifiant du billet associé (ex: AMR-AB12CD) */
  ticketId: string;
  /** Identifiant de la réservation associée */
  reservationId?: string;
  /** Données passager & traversée associées pour validation instantanée sans jointure */
  passengerName: string;
  phone?: string;
  itinerary?: string;
  ship?: string;
  travelDate?: string;
  departureTime?: string;
  travelClass?: string;
  passengersCount: number;
  /** État du jeton (Anti-rejoue) */
  status: QrTokenStatus;
  /** Horodatage d'utilisation (quand le passager a franchi la porte) */
  usedAt?: Date;
  /** Identifiant du scanner ou de l'agent d'embarquement */
  usedByScannerId?: string;
  /** Empreinte de l'appareil ou adresse IP ayant validé le scan */
  ipAddress?: string;
  deviceFingerprint?: string;
  /** Date d'expiration pour l'index TTL MongoDB */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QrTokenSchema = new Schema<IQrToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true // Recherche ultra-rapide O(1)
    },
    signature: {
      type: String,
      required: true,
      trim: true
    },
    nonce: {
      type: String,
      required: true,
      trim: true
    },
    ticketId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    reservationId: {
      type: String,
      trim: true,
      index: true
    },
    passengerName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      default: ''
    },
    itinerary: {
      type: String,
      default: 'GOMA - BUKAVU'
    },
    ship: {
      type: String,
      default: 'Mugote 1'
    },
    travelDate: {
      type: String,
      default: ''
    },
    departureTime: {
      type: String,
      default: ''
    },
    travelClass: {
      type: String,
      default: 'Standard'
    },
    passengersCount: {
      type: Number,
      default: 1,
      min: 1
    },
    status: {
      type: String,
      enum: ['PENDING', 'USED', 'EXPIRED', 'REVOKED'],
      default: 'PENDING',
      index: true
    },
    usedAt: {
      type: Date,
      default: null
    },
    usedByScannerId: {
      type: String,
      default: null
    },
    ipAddress: {
      type: String,
      default: null
    },
    deviceFingerprint: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'qr_tokens'
  }
);

// =========================================================================
// INDEXATION PERFORMANCE & EXPIRATION AUTOMATIQUE (TTL)
// =========================================================================

// 1. Index Unique pour recherche O(1) sur le jeton
QrTokenSchema.index({ token: 1 }, { unique: true });

// 2. Index TTL (Time-To-Live) : MongoDB purge automatiquement les jetons expirés
// expireAfterSeconds: 0 supprime le document dès que la date "expiresAt" est dépassée
QrTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 3. Index composé pour validation atomique instantanée (statut + expiration + ticket)
QrTokenSchema.index({ token: 1, status: 1, expiresAt: 1 });
QrTokenSchema.index({ ticketId: 1, status: 1 });

export const QrToken: Model<IQrToken> = 
  mongoose.models.QrToken || mongoose.model<IQrToken>('QrToken', QrTokenSchema);

export default QrToken;
