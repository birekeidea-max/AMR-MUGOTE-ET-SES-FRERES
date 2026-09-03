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
      if (errData.error) {
        errorMsg = errData.error;
        if (errData.details) {
          errorMsg += ` : ${errData.details}`;
        }
      } else if (errData.message) {
        errorMsg = errData.message;
      }
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

  // 9. Non-Destructive Data Migration & Item-level Sync
  syncItem: (type: 'settings' | 'schedule' | 'boat' | 'fleet' | 'news' | 'user' | 'reservation', data: any) => apiRequest<{
    success: boolean;
    type: string;
    id: string;
    message: string;
  }>('/sync/item', {
    method: 'POST',
    body: JSON.stringify({ type, data }),
  }),

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

  // 11. Real-Time MongoDB Atlas Event Stream & Polling
  getRealtimeStatus: () => apiRequest<{
    status: string;
    realtime: {
      activeListeners: number;
      recentEventsCount: number;
      changeStreamActive: boolean;
      changeStreamError: string | null;
      mongoReadyState: number;
    };
    db: {
      isConnected: boolean;
      databaseStatus: string;
      dbName?: string;
    };
  }>('/realtime/status'),

  pollRealtime: (since?: number) => {
    const q = since ? `?since=${since}` : '';
    return apiRequest<{
      events: Array<{
        id: string;
        type: string;
        action: string;
        data?: any;
        timestamp: number;
      }>;
      timestamp: number;
      status: any;
    }>(`/realtime/poll${q}`);
  },

  /**
   * Connect to real-time Server-Sent Events (SSE) stream with automatic fallback and reconnection.
   */
  subscribeToRealtime: (onEvent: (event: any) => void) => {
    if (typeof window === 'undefined') return () => {};

    let eventSource: EventSource | null = null;
    let fallbackInterval: any = null;
    let lastTimestamp = Date.now();
    let isConnected = false;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/realtime/stream');

        eventSource.onopen = () => {
          isConnected = true;
          if (fallbackInterval) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
          }
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.timestamp) lastTimestamp = data.timestamp;
            onEvent(data);
          } catch (e) {
            // Ignore non-json or keepalive messages
          }
        };

        eventSource.onerror = () => {
          isConnected = false;
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Start polling fallback if SSE encounters network issues
          if (!fallbackInterval) {
            fallbackInterval = setInterval(async () => {
              try {
                const res = await mongoApi.pollRealtime(lastTimestamp);
                if (res?.events && res.events.length > 0) {
                  for (const evt of res.events) {
                    onEvent(evt);
                  }
                  lastTimestamp = res.timestamp;
                }
              } catch {
                // Ignore transient polling failure
              }
            }, 3000);
          }
          // Try reconnecting SSE after 8 seconds
          setTimeout(connectSSE, 8000);
        };
      } catch {
        // SSE not supported or blocked, use polling fallback
        if (!fallbackInterval) {
          fallbackInterval = setInterval(async () => {
            try {
              const res = await mongoApi.pollRealtime(lastTimestamp);
              if (res?.events && res.events.length > 0) {
                for (const evt of res.events) {
                  onEvent(evt);
                }
                lastTimestamp = res.timestamp;
              }
            } catch {
              // Ignore
            }
          }, 3000);
        }
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }
};
