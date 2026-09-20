import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteSettings extends Document {
  key: string;
  homeBg?: string;
  homeDetail?: string;
  adminCode?: string;
  contactPhone?: string;
  classPrices: {
    VIP: number;
    '1ère Classe': number;
    '2ème Classe': number;
    '3ème Classe': number;
  };
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  emailFrom?: string;
  updatedAt: Date;
}

const SiteSettingsSchema = new Schema<ISiteSettings>({
  key: { type: String, required: true, unique: true, default: 'site' },
  homeBg: { type: String, default: '' },
  homeDetail: { type: String, default: '' },
  adminCode: { type: String, default: 'MUGOTE2025' },
  contactPhone: { type: String, default: '+243 994 286 469' },
  classPrices: {
    VIP: { type: Number, default: 27 },
    '1ère Classe': { type: Number, default: 27 },
    '2ème Classe': { type: Number, default: 17 },
    '3ème Classe': { type: Number, default: 10 },
  },
  smtpHost: { type: String, default: 'smtp.gmail.com' },
  smtpPort: { type: Number, default: 465 },
  smtpSecure: { type: Boolean, default: true },
  smtpUser: { type: String, default: '' },
  smtpPass: { type: String, default: '' },
  emailFrom: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'site_settings'
});

export const SiteSettings: mongoose.Model<ISiteSettings> = 
  mongoose.models.SiteSettings || mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema);
