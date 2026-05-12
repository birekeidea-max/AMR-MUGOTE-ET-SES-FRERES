export type TravelClass = '1ère Classe' | '2ème Classe' | '3ème Classe' | 'VIP';
export type ReservationStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';
export type Itinerary = 'Bukavu-Goma' | 'Goma-Bukavu';
export type ShipName = 'Mugote 1' | 'Mugote 2' | 'Mugote 3';

export interface Reservation {
  id?: string;
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
  transactionId: string;
  amount: number;
  createdAt: number;
  validatedAt?: number;
  validatedBy?: string;
  ticketId?: string;
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
