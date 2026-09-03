import mongoose from 'mongoose';

// Global cache interface for Serverless environments (Vercel, AWS Lambda)
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose || global.mongooseCache || { conn: null, promise: null };
if (!global.mongoose) {
  global.mongoose = cached;
}
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let lastError: string | null = null;

export async function connectMongoDB(): Promise<boolean> {
  // 1. Réutilise l'instance de connexion existante si mongoose.connection.readyState === 1
  if (mongoose.connection.readyState === 1) {
    connectionStatus = 'connected';
    return true;
  }

  // Si le cache global possède une connexion active
  if (cached.conn && cached.conn.connection.readyState === 1) {
    connectionStatus = 'connected';
    return true;
  }

  // 2. Lecture sécurisée de la chaîne de connexion MONGODB_URI
  const uri = process.env.MONGODB_URI ? process.env.MONGODB_URI.trim() : '';

  if (!uri) {
    const msg = "MONGODB_URI n'est pas configuré dans process.env.";
    console.warn(`⚠️ [MongoDB] ${msg}`);
    connectionStatus = 'disconnected';
    lastError = msg;
    return false;
  }

  // 3. Réutilisation de la promesse de connexion en cours (évite les connexions concurrentes sur Serverless)
  if (!cached.promise) {
    connectionStatus = 'connecting';
    console.log("🔄 [MongoDB] Initialisation connexion MongoDB Atlas (Serverless Vercel)...");
    
    // Configurations Mongoose
    mongoose.set('strictQuery', false);

    const opts: mongoose.ConnectOptions = {
      bufferCommands: true, // Bufferiser les commandes pour éviter les erreurs immédiates pendant l'établissement
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    cached.promise = mongoose.connect(uri, opts).then((m) => {
      console.log("✅ [MongoDB] Connecté avec succès à la base :", m.connection.name || 'default');
      return m;
    }).catch((err) => {
      cached.promise = null; // Libérer le cache en cas d'échec pour permettre un nouvel essai
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
    connectionStatus = 'connected';
    lastError = null;
    return true;
  } catch (error: any) {
    cached.promise = null;
    cached.conn = null;
    connectionStatus = 'error';
    lastError = error?.message || String(error);
    console.error("❌ [MongoDB] Échec de la connexion MongoDB :", lastError);
    return false;
  }
}

mongoose.connection.on('disconnected', () => {
  connectionStatus = 'disconnected';
  if (cached) {
    cached.conn = null;
    cached.promise = null;
  }
  console.log("⚠️ [MongoDB] Disconnected from MongoDB Atlas");
});

mongoose.connection.on('reconnected', () => {
  connectionStatus = 'connected';
  console.log("🔄 [MongoDB] Reconnected to MongoDB Atlas");
});

export function getDatabaseStatus() {
  const stateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized',
  };

  return {
    database: 'mongodb',
    databaseStatus: stateMap[mongoose.connection.readyState] || connectionStatus,
    isConnected: mongoose.connection.readyState === 1,
    dbName: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    lastError,
  };
}
