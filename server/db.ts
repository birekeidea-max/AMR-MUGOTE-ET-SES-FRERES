import mongoose from 'mongoose';

// Global cache interface for Serverless environments (Vercel, AWS Lambda)
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let lastError: string | null = null;

export async function connectMongoDB(): Promise<boolean> {
  // 1. If already connected in current runtime or readyState is 1 (connected), reuse immediately
  if (mongoose.connection.readyState === 1) {
    connectionStatus = 'connected';
    return true;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    console.warn("⚠️ [MongoDB] MONGODB_URI is not defined in environment.");
    connectionStatus = 'disconnected';
    return false;
  }

  // 2. If a connection is already cached and active
  if (cached.conn && cached.conn.connection.readyState === 1) {
    connectionStatus = 'connected';
    return true;
  }

  // 3. If a connection promise is in-flight, await it to prevent duplicate connection attempts
  if (!cached.promise) {
    connectionStatus = 'connecting';
    console.log("🔄 [MongoDB] Establishing connection to MongoDB Atlas (Serverless pool)...");
    
    // Set Mongoose configurations
    mongoose.set('strictQuery', false);

    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    cached.promise = mongoose.connect(uri, opts).then((m) => {
      console.log("✅ MongoDB connected successfully to database:", m.connection.name || 'default');
      return m;
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
    console.error("❌ MongoDB connection failed:", lastError);
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
