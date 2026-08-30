export type TravelClass = '1ère Classe' | '2ème Classe' | '3ème Classe' | 'VIP';
export type ReservationStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';
export type Itinerary = 'Bukavu-Goma' | 'Goma-Bukavu';
export type ShipName = 'Mugote 1' | 'Mugote 2' | 'Mugote 3';

export interface Reservation {
  id?: string;
  _id?: string;
  userId: string;
  fullName: string;
  lastName: string;
  phone: string;
  email?: string;
  itinerary: Itinerary;
  ship: ShipName;
  travelDate: string;
  departureTime: string;
  travelClass: TravelClass;
  passengersCount: number;
  status: ReservationStatus;
  paymentMethod: string;
  momoOperator?: string;
  identityNum?: string;
  transactionId: string;
  amount: number;
  createdAt: number;
  bookingDateFormatted?: string;
  bookingTimeFormatted?: string;
  validatedAt?: any;
  validatedBy?: string;
  ticketId?: string;
  boardingStatus?: 'PENDING' | 'BOARDED';
  boardedAt?: number;
  notes?: string;
  isUsed?: boolean;
  usedAt?: any;
}

export interface Schedule {
  id?: string;
  _id?: string;
  from: string;
  to: string;
  time: string;
  ship?: string;
  days?: string;
}

export interface News {
  id?: string;
  title: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  publishedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'CLIENT' | 'ADMIN';
  isVerified: boolean;
}

export type ClassPrices = Record<TravelClass, number>;

export const DEFAULT_PRICES: Record<TravelClass, number> = {
  'VIP': 27,
  '1ère Classe': 27,
  '2ème Classe': 17,
  '3ème Classe': 10
};

export const getClassPrices = (settings?: SiteSettings | null): Record<TravelClass, number> => {
  return {
    'VIP': Number(settings?.classPrices?.['VIP'] ?? DEFAULT_PRICES['VIP']),
    '1ère Classe': Number(settings?.classPrices?.['1ère Classe'] ?? DEFAULT_PRICES['1ère Classe']),
    '2ème Classe': Number(settings?.classPrices?.['2ème Classe'] ?? DEFAULT_PRICES['2ème Classe']),
    '3ème Classe': Number(settings?.classPrices?.['3ème Classe'] ?? DEFAULT_PRICES['3ème Classe']),
  };
};

export const getPriceForClass = (travelClass: TravelClass, settings?: SiteSettings | null): number => {
  const prices = getClassPrices(settings);
  return prices[travelClass] ?? DEFAULT_PRICES[travelClass] ?? 20;
};

export interface SiteSettings {
  homeBg?: string;
  homeDetail?: string;
  logo?: string;
  adminCode?: string;
  classPrices?: Partial<Record<TravelClass, number>>;
}
