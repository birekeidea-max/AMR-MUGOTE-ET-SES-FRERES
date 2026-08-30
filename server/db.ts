import mongoose from 'mongoose';

let isConnected = false;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let lastError: string | null = null;

export async function connectMongoDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    console.warn("⚠️ [MongoDB] MONGODB_URI is not defined in environment. Ready for connection when configured in .env");
    connectionStatus = 'disconnected';
    return false;
  }

  try {
    connectionStatus = 'connecting';
    console.log("🔄 [MongoDB] Connecting to MongoDB Atlas...");
    
    // Set Mongoose configurations
    mongoose.set('strictQuery', false);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    connectionStatus = 'connected';
    lastError = null;
    console.log("✅ MongoDB connected successfully to database:", mongoose.connection.name || 'default');
    return true;
  } catch (error: any) {
    isConnected = false;
    connectionStatus = 'error';
    lastError = error?.message || String(error);
    console.error("❌ MongoDB connection failed:", lastError);
    return false;
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  connectionStatus = 'disconnected';
  console.log("⚠️ [MongoDB] Disconnected from MongoDB Atlas");
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
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
