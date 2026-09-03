import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Reservation } from './models';

// Interface for Realtime Events
export interface RealtimeEventPayload {
  id: string;
  type: string;
  action: 'created' | 'updated' | 'deleted' | 'composted' | 'synced' | 'heartbeat';
  collectionName?: string;
  data?: any;
  timestamp: number;
}

// In-process Event Emitter
class RealtimeManager extends EventEmitter {
  private recentEvents: RealtimeEventPayload[] = [];
  private maxStoredEvents = 100;
  private changeStreamActive = false;
  private changeStreamError: string | null = null;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  public emitEvent(type: string, action: RealtimeEventPayload['action'], data?: any, collectionName?: string) {
    const payload: RealtimeEventPayload = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      action,
      collectionName: collectionName || 'reservations',
      data,
      timestamp: Date.now()
    };

    // Store in circular buffer for polling fallback
    this.recentEvents.push(payload);
    if (this.recentEvents.length > this.maxStoredEvents) {
      this.recentEvents.shift();
    }

    // Emit to all connected SSE clients
    this.emit('realtime_change', payload);
    this.emit(type, payload);
    return payload;
  }

  public getRecentEvents(sinceTimestamp?: number): RealtimeEventPayload[] {
    if (!sinceTimestamp || isNaN(sinceTimestamp)) {
      return this.recentEvents.slice(-25);
    }
    return this.recentEvents.filter(e => e.timestamp > sinceTimestamp);
  }

  // Attempt to initialize MongoDB Change Stream (Atlas replica set)
  public initMongoChangeStreams() {
    if (this.changeStreamActive) return;

    try {
      if (mongoose.connection.readyState !== 1) {
        return;
      }

      // Check if replica set is available
      const isReplica = (mongoose.connection.db as any)?.serverConfig?.isReplicaSet?.() ?? true;
      if (!isReplica) {
        this.changeStreamError = "MongoDB n'est pas configuré en Replica Set (Change Streams désactivés).";
        return;
      }

      console.log("⚡ [MongoDB Real-Time] Initialisation des Change Streams Atlas...");

      // Watch reservations collection
      const reservationChangeStream = Reservation.watch([], { fullDocument: 'updateLookup' });

      reservationChangeStream.on('change', (change: any) => {
        const opType = change.operationType;
        let action: RealtimeEventPayload['action'] = 'updated';
        if (opType === 'insert') action = 'created';
        else if (opType === 'delete') action = 'deleted';

        console.log(`📡 [MongoDB ChangeStream] Détection opération ${opType} sur réservations (ID: ${change.documentKey?._id})`);

        this.emitEvent('reservation:change', action, change.fullDocument || { _id: change.documentKey?._id }, 'reservations');
      });

      reservationChangeStream.on('error', (err: any) => {
        console.warn("⚠️ [MongoDB Real-Time] Avertissement Change Stream (Fallback sur EventEmitter activé):", err?.message || err);
        this.changeStreamActive = false;
        this.changeStreamError = err?.message || String(err);
      });

      this.changeStreamActive = true;
      this.changeStreamError = null;
      console.log("✅ [MongoDB Real-Time] Change Streams Atlas activés avec succès.");
    } catch (err: any) {
      this.changeStreamActive = false;
      this.changeStreamError = err?.message || String(err);
      console.warn("⚠️ [MongoDB Real-Time] Fallback sur Event Hub interne (Change Streams non supportés dans cet environnement) :", this.changeStreamError);
    }
  }

  public getStatus() {
    return {
      activeListeners: this.listenerCount('realtime_change'),
      recentEventsCount: this.recentEvents.length,
      changeStreamActive: this.changeStreamActive,
      changeStreamError: this.changeStreamError,
      mongoReadyState: mongoose.connection.readyState
    };
  }
}

export const realtimeHub = new RealtimeManager();

// Automatically attempt to start Change Stream when MongoDB connects
mongoose.connection.on('connected', () => {
  setTimeout(() => {
    realtimeHub.initMongoChangeStreams();
  }, 1000);
});

// SSE Handler Function for Express
export function handleSSEStream(req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connection:ready',
    action: 'heartbeat',
    timestamp: Date.now(),
    message: 'Connecté au flux Real-Time MongoDB Atlas ETS AMR MUGOTE'
  })}\n\n`);

  // Send recent history so subscriber doesn't miss latest items
  const recent = realtimeHub.getRecentEvents();
  if (recent.length > 0) {
    res.write(`data: ${JSON.stringify({
      type: 'history:sync',
      action: 'synced',
      data: recent.slice(-10),
      timestamp: Date.now()
    })}\n\n`);
  }

  // Listener for new events
  const onNewEvent = (payload: RealtimeEventPayload) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      // Client closed
    }
  };

  realtimeHub.on('realtime_change', onNewEvent);

  // Keep-alive heartbeat every 15 seconds to prevent serverless timeout
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: keepalive ${Date.now()}\n\n`);
    } catch (e) {
      clearInterval(heartbeatInterval);
    }
  }, 15000);

  // Clean up on disconnect
  req.on('close', () => {
    realtimeHub.off('realtime_change', onNewEvent);
    clearInterval(heartbeatInterval);
  });

  req.on('end', () => {
    realtimeHub.off('realtime_change', onNewEvent);
    clearInterval(heartbeatInterval);
  });
}
