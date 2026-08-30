import { auth } from '../lib/firebase';
import { Reservation, Schedule, SiteSettings } from '../types';

const API_BASE = '/api';

/**
 * Retrieves the current Firebase Auth ID token if a user is logged in.
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch (err) {
    console.warn("Could not get Firebase ID token:", err);
  }
  return null;
}

/**
 * Standard fetch wrapper with JSON handling and Firebase Bearer token attachment.
 */
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`;
    try {
      const errData = await response.json();
      errorMsg = errData.error || errData.message || errorMsg;
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const mongoApi = {
  // 1. Health & Database Status
  getHealth: () => apiRequest<{
    server: string;
    database: string;
    databaseStatus: string;
    isConnected: boolean;
    counts?: Record<string, number>;
  }>('/health'),

  // 2. Site Settings & Official Tariffs
  getSettings: () => apiRequest<SiteSettings>('/settings'),
  updateSettings: (data: Partial<SiteSettings>) => apiRequest<SiteSettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 3. Schedules (Horaires)
  getSchedules: () => apiRequest<Schedule[]>('/schedules'),
  createSchedule: (schedule: Omit<Schedule, 'id'>) => apiRequest<Schedule>('/schedules', {
    method: 'POST',
    body: JSON.stringify(schedule),
  }),
  updateSchedule: (id: string, schedule: Partial<Schedule>) => apiRequest<Schedule>(`/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(schedule),
  }),
  deleteSchedule: (id: string) => apiRequest<{ success: boolean }>(`/schedules/${id}`, {
    method: 'DELETE',
  }),

  // 4. Fleet (Flotte de Bateaux)
  getFleet: () => apiRequest<any[]>('/fleet'),
  createBoat: (boat: any) => apiRequest<any>('/fleet', {
    method: 'POST',
    body: JSON.stringify(boat),
  }),
  updateBoat: (id: string, boat: any) => apiRequest<any>(`/fleet/${id}`, {
    method: 'PUT',
    body: JSON.stringify(boat),
  }),
  deleteBoat: (id: string) => apiRequest<{ success: boolean }>(`/fleet/${id}`, {
    method: 'DELETE',
  }),

  // 5. Reservations & Billetterie
  getReservations: (params?: { userId?: string; phone?: string; status?: string; travelDate?: string; search?: string; ticketId?: string }) => {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId);
    if (params?.phone) query.append('phone', params.phone);
    if (params?.status) query.append('status', params.status);
    if (params?.travelDate) query.append('travelDate', params.travelDate);
    if (params?.search) query.append('search', params.search);
    if (params?.ticketId) query.append('ticketId', params.ticketId);
    return apiRequest<Reservation[]>(`/reservations?${query.toString()}`);
  },
  getReservation: (idOrTicket: string) => apiRequest<Reservation>(`/reservations/${idOrTicket}`),
  createReservation: (data: Partial<Reservation>) => apiRequest<Reservation>('/reservations', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateReservation: (id: string, data: Partial<Reservation>) => apiRequest<Reservation>(`/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  updateReservationStatus: (id: string, data: Partial<Reservation>) => apiRequest<Reservation>(`/reservations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteReservation: (id: string) => apiRequest<{ success: boolean }>(`/reservations/${id}`, {
    method: 'DELETE',
  }),
  scanVerify: (rawCode: string, action: 'check' | 'compost' = 'check') => apiRequest<{
    valid: boolean;
    status: 'success' | 'alert_reused' | 'alert_unpaid' | 'error_not_found';
    reservation?: Reservation;
    message: string;
  }>('/reservations/scan-verify', {
    method: 'POST',
    body: JSON.stringify({ rawCode, action }),
  }),

  // 6. News & Media
  getNews: () => apiRequest<any[]>('/news'),
  getNewsItem: (id: string) => apiRequest<any>(`/news/${id}`),
  createNews: (news: any) => apiRequest<any>('/news', {
    method: 'POST',
    body: JSON.stringify(news),
  }),
  updateNews: (id: string, news: any) => apiRequest<any>(`/news/${id}`, {
    method: 'PUT',
    body: JSON.stringify(news),
  }),
  deleteNews: (id: string) => apiRequest<{ success: boolean }>(`/news/${id}`, {
    method: 'DELETE',
  }),
  incrementNewsViews: (id: string) => apiRequest<{ views: number }>(`/news/${id}/views`, {
    method: 'POST',
  }),
  getNewsComments: (newsId: string) => apiRequest<any[]>(`/news/${newsId}/comments`),
  addNewsComment: (newsId: string, comment: { userId?: string; userName: string; text: string; userAvatar?: string }) => apiRequest<any>(`/news/${newsId}/comments`, {
    method: 'POST',
    body: JSON.stringify(comment),
  }),

  // 7. Users
  getUsers: () => apiRequest<any[]>('/users'),
  syncUser: (userData: { uid: string; email?: string; displayName?: string; phone?: string; photoURL?: string; role?: string; isVerified?: boolean }) => apiRequest<any>('/users/sync', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  updateUser: (uid: string, data: any) => apiRequest<any>(`/users/${uid}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // 8. Conversations & Support
  getConversations: (userId?: string) => {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return apiRequest<any[]>(`/conversations${q}`);
  },
  createConversation: (data: { userId: string; userName?: string; userEmail?: string; lastMessage?: string }) => apiRequest<any>('/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMessages: (conversationId: string) => apiRequest<any[]>(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, data: { text: string; senderId?: string; senderRole?: 'USER' | 'ADMIN' | 'AI' }) => apiRequest<any>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 9. Non-Destructive Data Migration
  triggerMigration: () => apiRequest<{
    success: boolean;
    message: string;
    stats: Record<string, { migrated: number; errors: number }>;
  }>('/migrate/firestore-to-mongodb', {
    method: 'POST',
  }),

  batchMigration: (data: {
    settings?: any;
    schedules?: any[];
    fleet?: any[];
    news?: any[];
    users?: any[];
    reservations?: any[];
  }) => apiRequest<{
    success: boolean;
    message: string;
    stats: Record<string, { migrated: number; errors: number }>;
  }>('/migrate/batch', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // 10. Connection Management
  reconnect: () => apiRequest<{
    success: boolean;
    status: string;
    isConnected: boolean;
    lastError?: string | null;
  }>('/reconnect', {
    method: 'POST',
  }),
};
