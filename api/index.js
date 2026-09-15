// server/app.ts
import express from "express";
import cors from "cors";
import "dotenv/config";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

// server/db.ts
import mongoose from "mongoose";
var cached = global.mongoose || global.mongooseCache || { conn: null, promise: null };
if (!global.mongoose) {
  global.mongoose = cached;
}
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}
var connectionStatus = "disconnected";
var lastError = null;
async function connectMongoDB() {
  if (mongoose.connection.readyState === 1) {
    connectionStatus = "connected";
    return true;
  }
  if (cached.conn && cached.conn.connection.readyState === 1) {
    connectionStatus = "connected";
    return true;
  }
  const DEFAULT_URI = "mongodb+srv://birekeidea_db_user:ftTd0ga6DlinPxt0@cluster0.bf7ikuc.mongodb.net/amr_mugote?retryWrites=true&w=majority&appName=Cluster0";
  const uri = (process.env.MONGODB_URI ? process.env.MONGODB_URI.trim() : "") || DEFAULT_URI;
  if (!uri) {
    const msg = "MONGODB_URI n'est pas configur\xE9 dans process.env.";
    console.warn(`\u26A0\uFE0F [MongoDB] ${msg}`);
    connectionStatus = "disconnected";
    lastError = msg;
    return false;
  }
  if (!cached.promise) {
    connectionStatus = "connecting";
    console.log("\u{1F504} [MongoDB] Initialisation connexion MongoDB Atlas (Serverless Vercel)...");
    mongoose.set("strictQuery", false);
    const opts = {
      bufferCommands: true,
      // Bufferiser les commandes pour éviter les erreurs immédiates pendant l'établissement
      serverSelectionTimeoutMS: 1e4,
      socketTimeoutMS: 45e3,
      maxPoolSize: 10
    };
    cached.promise = mongoose.connect(uri, opts).then((m) => {
      console.log("\u2705 [MongoDB] Connect\xE9 avec succ\xE8s \xE0 la base :", m.connection.name || "default");
      return m;
    }).catch((err) => {
      cached.promise = null;
      throw err;
    });
  }
  try {
    cached.conn = await cached.promise;
    connectionStatus = "connected";
    lastError = null;
    return true;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    connectionStatus = "error";
    lastError = error?.message || String(error);
    console.error("\u274C [MongoDB] \xC9chec de la connexion MongoDB :", lastError);
    return false;
  }
}
mongoose.connection.on("disconnected", () => {
  connectionStatus = "disconnected";
  if (cached) {
    cached.conn = null;
    cached.promise = null;
  }
  console.log("\u26A0\uFE0F [MongoDB] Disconnected from MongoDB Atlas");
});
mongoose.connection.on("reconnected", () => {
  connectionStatus = "connected";
  console.log("\u{1F504} [MongoDB] Reconnected to MongoDB Atlas");
});
function getDatabaseStatus() {
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
    99: "uninitialized"
  };
  return {
    database: "mongodb",
    databaseStatus: stateMap[mongoose.connection.readyState] || connectionStatus,
    isConnected: mongoose.connection.readyState === 1,
    dbName: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    lastError
  };
}

// server/routes/api.ts
import { Router } from "express";
import mongoose12 from "mongoose";
import admin2 from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// server/realtime.ts
import { EventEmitter } from "events";
import mongoose11 from "mongoose";

// server/models/SiteSettings.ts
import mongoose2, { Schema } from "mongoose";
var SiteSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "site" },
  homeBg: { type: String, default: "" },
  homeDetail: { type: String, default: "" },
  adminCode: { type: String, default: "MUGOTE2025" },
  contactPhone: { type: String, default: "+243 994 286 469" },
  classPrices: {
    VIP: { type: Number, default: 27 },
    "1\xE8re Classe": { type: Number, default: 27 },
    "2\xE8me Classe": { type: Number, default: 17 },
    "3\xE8me Classe": { type: Number, default: 10 }
  },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: "site_settings"
});
var SiteSettings = mongoose2.models.SiteSettings || mongoose2.model("SiteSettings", SiteSettingsSchema);

// server/models/Schedule.ts
import mongoose3, { Schema as Schema2 } from "mongoose";
var ScheduleSchema = new Schema2({
  firestoreId: { type: String, index: true },
  from: { type: String, default: "Bukavu" },
  to: { type: String, default: "Goma" },
  time: { type: String, default: "07h30" },
  departureTime: { type: String, default: "07h30" },
  itinerary: { type: String, default: "Bukavu-Goma" },
  frequency: { type: String, default: "Quotidien" },
  ship: { type: String, default: "Mugote 1" },
  days: { type: Schema2.Types.Mixed, default: "Tous les jours" },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: "schedules",
  strict: false
});
ScheduleSchema.index({ itinerary: 1, departureTime: 1 });
ScheduleSchema.index({ from: 1, to: 1, time: 1 });
var Schedule = mongoose3.models.Schedule || mongoose3.model("Schedule", ScheduleSchema);

// server/models/Boat.ts
import mongoose4, { Schema as Schema3 } from "mongoose";
var BoatSchema = new Schema3({
  firestoreId: { type: String, index: true },
  name: { type: String, required: true },
  capacity: { type: Number, required: true, default: 120 },
  description: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  gallery: [{ type: String }],
  status: { type: String, default: "ACTIF" }
}, {
  timestamps: true,
  collection: "fleet"
});
BoatSchema.index({ name: 1 });
var Boat = mongoose4.models.Boat || mongoose4.model("Boat", BoatSchema);

// server/models/Reservation.ts
import mongoose5, { Schema as Schema4 } from "mongoose";
var ReservationSchema = new Schema4({
  firestoreId: { type: String, index: true },
  ticketId: { type: String, index: true, sparse: true },
  fullName: { type: String, default: "Passager" },
  lastName: { type: String, default: "" },
  phone: { type: String, default: "N/A", index: true },
  email: { type: String, index: true, default: "" },
  itinerary: { type: String, default: "Bukavu-Goma" },
  ship: { type: String, default: "Mugote 1" },
  travelDate: { type: String, default: () => (/* @__PURE__ */ new Date()).toISOString().split("T")[0], index: true },
  departureTime: { type: String, default: "07h30" },
  travelClass: { type: String, default: "2\xE8me Classe" },
  passengersCount: { type: Number, default: 1, min: 1 },
  passengersList: [{
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    travelClass: { type: String, default: "" }
  }],
  status: {
    type: String,
    default: "PENDING",
    index: true
  },
  paymentMethod: { type: String, default: "Mobile Money" },
  transactionId: { type: String, index: true, default: "" },
  trackingRef: { type: String, index: true, default: "" },
  amount: { type: Number, default: 20 },
  currency: { type: String, default: "USD" },
  userId: { type: String, index: true, default: "" },
  notes: { type: String, default: "" },
  isUsed: { type: Boolean, default: false },
  usedAt: { type: Date },
  validatedAt: { type: Date }
}, {
  timestamps: true,
  collection: "reservations"
});
ReservationSchema.index({ phone: 1, travelDate: -1 });
ReservationSchema.index({ userId: 1, createdAt: -1 });
ReservationSchema.index({ status: 1, travelDate: -1 });
ReservationSchema.index({ ticketId: 1, status: 1 });
var Reservation = mongoose5.models.Reservation || mongoose5.model("Reservation", ReservationSchema);

// server/models/News.ts
import mongoose6, { Schema as Schema5 } from "mongoose";
var NewsSchema = new Schema5({
  firestoreId: { type: String, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: { type: String, default: "" },
  videoUrl: { type: String, default: "" },
  media: [{ type: String }],
  author: { type: String, default: "Direction AMR Mugote" },
  views: { type: Number, default: 0 },
  publishedAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  collection: "news"
});
NewsSchema.index({ publishedAt: -1 });
var News = mongoose6.models.News || mongoose6.model("News", NewsSchema);

// server/models/Comment.ts
import mongoose7, { Schema as Schema6 } from "mongoose";
var CommentSchema = new Schema6({
  firestoreId: { type: String, index: true },
  newsId: { type: String, required: true, index: true },
  userId: { type: String, default: "" },
  userName: { type: String, required: true },
  userAvatar: { type: String, default: "" },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  collection: "news_comments"
});
CommentSchema.index({ newsId: 1, createdAt: -1 });
var Comment = mongoose7.models.Comment || mongoose7.model("Comment", CommentSchema);

// server/models/User.ts
import mongoose8, { Schema as Schema7 } from "mongoose";
var UserSchema = new Schema7({
  firestoreId: { type: String, index: true },
  uid: { type: String, required: true, unique: true, sparse: true, index: true },
  email: { type: String, index: true, default: "" },
  displayName: { type: String, default: "" },
  phone: { type: String, default: "" },
  photoURL: { type: String, default: "" },
  role: { type: String, default: "CLIENT", index: true },
  isVerified: { type: Boolean, default: false },
  totalBookings: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastLogin: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: "users"
});
UserSchema.index({ email: 1, role: 1 });
UserSchema.index({ lastLogin: -1 });
var User = mongoose8.models.User || mongoose8.model("User", UserSchema);

// server/models/Conversation.ts
import mongoose9, { Schema as Schema8 } from "mongoose";
var ConversationSchema = new Schema8({
  firestoreId: { type: String, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: "Passager" },
  userEmail: { type: String, default: "" },
  lastMessage: { type: String, default: "" },
  status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },
  adminUnreadCount: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: "conversations"
});
ConversationSchema.index({ updatedAt: -1 });
var Conversation = mongoose9.models.Conversation || mongoose9.model("Conversation", ConversationSchema);

// server/models/Message.ts
import mongoose10, { Schema as Schema9 } from "mongoose";
var MessageSchema = new Schema9({
  firestoreId: { type: String, index: true },
  conversationId: { type: String, required: true, index: true },
  text: { type: String, required: true },
  senderId: { type: String, default: "" },
  senderRole: { type: String, enum: ["USER", "ADMIN", "AI"], default: "USER" },
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  collection: "messages"
});
MessageSchema.index({ conversationId: 1, createdAt: 1 });
var Message = mongoose10.models.Message || mongoose10.model("Message", MessageSchema);

// server/realtime.ts
var RealtimeManager = class extends EventEmitter {
  constructor() {
    super();
    this.recentEvents = [];
    this.maxStoredEvents = 100;
    this.changeStreamActive = false;
    this.changeStreamError = null;
    this.setMaxListeners(100);
  }
  emitEvent(type, action, data, collectionName) {
    const payload = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      action,
      collectionName: collectionName || "reservations",
      data,
      timestamp: Date.now()
    };
    this.recentEvents.push(payload);
    if (this.recentEvents.length > this.maxStoredEvents) {
      this.recentEvents.shift();
    }
    this.emit("realtime_change", payload);
    this.emit(type, payload);
    return payload;
  }
  getRecentEvents(sinceTimestamp) {
    if (!sinceTimestamp || isNaN(sinceTimestamp)) {
      return this.recentEvents.slice(-25);
    }
    return this.recentEvents.filter((e) => e.timestamp > sinceTimestamp);
  }
  // Attempt to initialize MongoDB Change Stream (Atlas replica set)
  initMongoChangeStreams() {
    if (this.changeStreamActive) return;
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      this.changeStreamActive = false;
      this.changeStreamError = "Environnement Serverless d\xE9tect\xE9 (Change Streams d\xE9sactiv\xE9s pour optimiser les performances).";
      return;
    }
    try {
      if (mongoose11.connection.readyState !== 1) {
        return;
      }
      const isReplica = mongoose11.connection.db?.serverConfig?.isReplicaSet?.() ?? true;
      if (!isReplica) {
        this.changeStreamError = "MongoDB n'est pas configur\xE9 en Replica Set (Change Streams d\xE9sactiv\xE9s).";
        return;
      }
      console.log("\u26A1 [MongoDB Real-Time] Initialisation des Change Streams Atlas...");
      const reservationChangeStream = Reservation.watch([], { fullDocument: "updateLookup" });
      reservationChangeStream.on("change", (change) => {
        const opType = change.operationType;
        let action = "updated";
        if (opType === "insert") action = "created";
        else if (opType === "delete") action = "deleted";
        console.log(`\u{1F4E1} [MongoDB ChangeStream] D\xE9tection op\xE9ration ${opType} sur r\xE9servations (ID: ${change.documentKey?._id})`);
        this.emitEvent("reservation:change", action, change.fullDocument || { _id: change.documentKey?._id }, "reservations");
      });
      reservationChangeStream.on("error", (err) => {
        console.warn("\u26A0\uFE0F [MongoDB Real-Time] Avertissement Change Stream (Fallback sur EventEmitter activ\xE9):", err?.message || err);
        this.changeStreamActive = false;
        this.changeStreamError = err?.message || String(err);
      });
      this.changeStreamActive = true;
      this.changeStreamError = null;
      console.log("\u2705 [MongoDB Real-Time] Change Streams Atlas activ\xE9s avec succ\xE8s.");
    } catch (err) {
      this.changeStreamActive = false;
      this.changeStreamError = err?.message || String(err);
      console.warn("\u26A0\uFE0F [MongoDB Real-Time] Fallback sur Event Hub interne (Change Streams non support\xE9s dans cet environnement) :", this.changeStreamError);
    }
  }
  getStatus() {
    return {
      activeListeners: this.listenerCount("realtime_change"),
      recentEventsCount: this.recentEvents.length,
      changeStreamActive: this.changeStreamActive,
      changeStreamError: this.changeStreamError,
      mongoReadyState: mongoose11.connection.readyState
    };
  }
};
var realtimeHub = new RealtimeManager();
mongoose11.connection.on("connected", () => {
  setTimeout(() => {
    realtimeHub.initMongoChangeStreams();
  }, 1e3);
});
function handleSSEStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(`data: ${JSON.stringify({
    type: "connection:ready",
    action: "heartbeat",
    timestamp: Date.now(),
    message: "Connect\xE9 au flux Real-Time MongoDB Atlas ETS AMR MUGOTE"
  })}

`);
  const recent = realtimeHub.getRecentEvents();
  if (recent.length > 0) {
    res.write(`data: ${JSON.stringify({
      type: "history:sync",
      action: "synced",
      data: recent.slice(-10),
      timestamp: Date.now()
    })}

`);
  }
  const onNewEvent = (payload) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}

`);
    } catch (err) {
    }
  };
  realtimeHub.on("realtime_change", onNewEvent);
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: keepalive ${Date.now()}

`);
    } catch (e) {
      clearInterval(heartbeatInterval);
    }
  }, 15e3);
  req.on("close", () => {
    realtimeHub.off("realtime_change", onNewEvent);
    clearInterval(heartbeatInterval);
  });
  req.on("end", () => {
    realtimeHub.off("realtime_change", onNewEvent);
    clearInterval(heartbeatInterval);
  });
}

// server/middleware/auth.ts
import admin from "firebase-admin";
async function optionalFirebaseAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return next();
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      name: decodedToken.name,
      ...decodedToken
    };
  } catch (error) {
    console.warn("Optional auth token invalid:", error);
  }
  next();
}

// server/routes/api.ts
var router = Router();
async function generateUniqueTicketId() {
  let uniqueTicketId = "";
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 15) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    uniqueTicketId = `AMR-${randomHex}`;
    const existing = await Reservation.findOne({ ticketId: uniqueTicketId });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  if (!uniqueTicketId) {
    uniqueTicketId = `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  return uniqueTicketId;
}
router.get(["/health", "/status"], async (req, res) => {
  const dbStatus = getDatabaseStatus();
  let counts = {};
  if (dbStatus.isConnected) {
    try {
      const [resCount, schedCount, newsCount, boatCount, userCount] = await Promise.all([
        Reservation.countDocuments().catch(() => 0),
        Schedule.countDocuments().catch(() => 0),
        News.countDocuments().catch(() => 0),
        Boat.countDocuments().catch(() => 0),
        User.countDocuments().catch(() => 0)
      ]);
      counts = {
        reservations: resCount,
        schedules: schedCount,
        news: newsCount,
        fleet: boatCount,
        users: userCount
      };
    } catch (e) {
      console.warn("Could not retrieve collection counts:", e);
    }
  }
  res.json({
    server: "ok",
    app: "AMR MUGOTE ET SES FR\xC8RES",
    database: "mongodb",
    databaseStatus: dbStatus.databaseStatus,
    isConnected: dbStatus.isConnected,
    dbName: dbStatus.dbName,
    lastError: dbStatus.lastError,
    counts,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
router.post("/reconnect", async (req, res) => {
  const success = await connectMongoDB();
  const dbStatus = getDatabaseStatus();
  res.json({
    success,
    status: dbStatus.databaseStatus,
    isConnected: dbStatus.isConnected,
    lastError: dbStatus.lastError
  });
});
router.get(["/realtime/stream", "/stream"], (req, res) => {
  handleSSEStream(req, res);
});
router.get(["/realtime/poll", "/poll"], (req, res) => {
  const since = req.query.since ? Number(req.query.since) : void 0;
  const events = realtimeHub.getRecentEvents(since);
  res.json({
    events,
    timestamp: Date.now(),
    status: realtimeHub.getStatus()
  });
});
router.get("/realtime/status", (req, res) => {
  res.json({
    status: "ok",
    realtime: realtimeHub.getStatus(),
    db: getDatabaseStatus(),
    timestamp: Date.now()
  });
});
router.get("/settings", async (req, res) => {
  try {
    let settings = await SiteSettings.findOne({ key: "site" });
    if (!settings) {
      settings = await SiteSettings.create({
        key: "site",
        adminCode: "MUGOTE2025",
        contactPhone: "+243 994 286 469",
        classPrices: {
          VIP: 27,
          "1\xE8re Classe": 27,
          "2\xE8me Classe": 17,
          "3\xE8me Classe": 10
        }
      });
    }
    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la r\xE9cup\xE9ration des param\xE8tres." });
  }
});
router.put("/settings", async (req, res) => {
  try {
    const updateData = req.body;
    const settings = await SiteSettings.findOneAndUpdate(
      { key: "site" },
      { $set: { ...updateData, updatedAt: /* @__PURE__ */ new Date() } },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error) {
    console.error("Error updating settings in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour des param\xE8tres." });
  }
});
router.get("/schedules", async (req, res) => {
  try {
    const schedules = await Schedule.find().sort({ time: 1 });
    res.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors du chargement des horaires." });
  }
});
router.post("/schedules", async (req, res) => {
  try {
    const { from, to, time, ship, days } = req.body;
    if (!from || !to || !time) {
      return res.status(400).json({ error: "Les champs provenance, destination et heure sont requis." });
    }
    const schedule = await Schedule.create({
      from,
      to,
      time,
      ship: ship || "Mugote 1",
      days: days || "Tous les jours"
    });
    res.status(201).json(schedule);
  } catch (error) {
    console.error("Error creating schedule in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la cr\xE9ation de l'horaire." });
  }
});
router.put("/schedules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!schedule) {
      return res.status(404).json({ error: "Horaire introuvable." });
    }
    res.json(schedule);
  } catch (error) {
    console.error("Error updating schedule in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la modification de l'horaire." });
  }
});
router.delete("/schedules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Schedule.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Horaire introuvable." });
    }
    res.json({ success: true, message: "Horaire supprim\xE9 avec succ\xE8s." });
  } catch (error) {
    console.error("Error deleting schedule from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'horaire." });
  }
});
router.get("/fleet", async (req, res) => {
  try {
    const boats = await Boat.find().sort({ name: 1 });
    res.json(boats);
  } catch (error) {
    console.error("Error fetching fleet from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors du chargement de la flotte." });
  }
});
router.post("/fleet", async (req, res) => {
  try {
    const { name, capacity, description, imageUrl, gallery, status } = req.body;
    if (!name || !capacity) {
      return res.status(400).json({ error: "Le nom et la capacit\xE9 du bateau sont requis." });
    }
    const boat = await Boat.create({
      name,
      capacity: Number(capacity),
      description: description || "",
      imageUrl: imageUrl || "",
      gallery: gallery || [],
      status: status || "ACTIF"
    });
    res.status(201).json(boat);
  } catch (error) {
    console.error("Error creating boat in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du navire." });
  }
});
router.put("/fleet/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const boat = await Boat.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!boat) {
      return res.status(404).json({ error: "Navire introuvable." });
    }
    res.json(boat);
  } catch (error) {
    console.error("Error updating boat in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour du navire." });
  }
});
router.delete("/fleet/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Boat.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Navire introuvable." });
    }
    res.json({ success: true, message: "Navire retir\xE9 de la flotte avec succ\xE8s." });
  } catch (error) {
    console.error("Error deleting boat from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du navire." });
  }
});
router.get("/reservations", async (req, res) => {
  try {
    const { userId, phone, status, travelDate, search, ticketId } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (phone) filter.phone = phone;
    if (status) filter.status = status;
    if (travelDate) filter.travelDate = travelDate;
    if (ticketId) filter.ticketId = String(ticketId).trim().toUpperCase();
    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filter.$or = [
        { fullName: searchRegex },
        { phone: searchRegex },
        { ticketId: searchRegex },
        { transactionId: searchRegex }
      ];
    }
    const reservations = await Reservation.find(filter).sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    console.error("Error fetching reservations from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la r\xE9cup\xE9ration des r\xE9servations." });
  }
});
router.get("/reservations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let reservation = null;
    if (id.startsWith("AMR-")) {
      reservation = await Reservation.findOne({ ticketId: id });
    } else if (id.length === 24) {
      reservation = await Reservation.findById(id);
    }
    if (!reservation) {
      reservation = await Reservation.findOne({
        $or: [{ _id: id }, { firestoreId: id }, { ticketId: id }, { transactionId: id }]
      });
    }
    if (!reservation) {
      return res.status(404).json({ error: "Billet / R\xE9servation introuvable." });
    }
    res.json(reservation);
  } catch (error) {
    console.error("Error fetching single reservation from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la recherche de la r\xE9servation." });
  }
});
router.post("/reservations", optionalFirebaseAuth, async (req, res) => {
  try {
    await connectMongoDB();
    const data = req.body;
    if (!data.fullName || !data.phone || !data.itinerary || !data.travelDate || !data.travelClass) {
      return res.status(400).json({ error: "Informations de r\xE9servation incompl\xE8tes." });
    }
    let ticketId = data.ticketId;
    if (!ticketId || !String(ticketId).startsWith("AMR-")) {
      ticketId = await generateUniqueTicketId();
    }
    const { _id, id, ...cleanData } = data;
    const reservation = await Reservation.create({
      ...cleanData,
      firestoreId: cleanData.firestoreId || id || _id,
      ticketId,
      passengersCount: Number(cleanData.passengersCount || 1),
      amount: Number(cleanData.amount || 20),
      status: cleanData.status || "PENDING",
      createdAt: cleanData.createdAt ? new Date(cleanData.createdAt) : /* @__PURE__ */ new Date()
    });
    if (cleanData.userId) {
      try {
        await User.findOneAndUpdate(
          { uid: cleanData.userId },
          {
            $inc: { totalBookings: 1, totalSpent: Number(cleanData.amount || 0) },
            $set: { lastLogin: /* @__PURE__ */ new Date() }
          },
          { upsert: true }
        );
      } catch (uErr) {
        console.warn("User stats update non-fatal error:", uErr);
      }
    }
    realtimeHub.emitEvent("reservation:created", "created", reservation, "reservations");
    res.status(201).json(reservation);
  } catch (err) {
    console.error("Error creating reservation in MongoDB:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});
router.put("/reservations/:id", async (req, res) => {
  try {
    await connectMongoDB();
    const { id } = req.params;
    const { _id, ...cleanUpdate } = req.body;
    const updateData = { ...cleanUpdate, updatedAt: /* @__PURE__ */ new Date() };
    let reservation = null;
    if (mongoose12.Types.ObjectId.isValid(id)) {
      reservation = await Reservation.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    }
    if (!reservation) {
      reservation = await Reservation.findOneAndUpdate(
        { $or: [{ ticketId: id }, { firestoreId: id }] },
        { $set: updateData },
        { new: true }
      );
    }
    if (!reservation) {
      return res.status(404).json({ error: "R\xE9servation introuvable." });
    }
    realtimeHub.emitEvent("reservation:updated", "updated", reservation, "reservations");
    res.json(reservation);
  } catch (err) {
    console.error("Error updating reservation in MongoDB:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});
router.delete("/reservations/:id", async (req, res) => {
  try {
    await connectMongoDB();
    const { id } = req.params;
    let deleted = null;
    if (mongoose12.Types.ObjectId.isValid(id)) {
      deleted = await Reservation.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await Reservation.findOneAndDelete({
        $or: [{ ticketId: id }, { firestoreId: id }]
      });
    }
    if (!deleted) {
      return res.status(404).json({ error: "R\xE9servation introuvable." });
    }
    realtimeHub.emitEvent("reservation:deleted", "deleted", { id, ticketId: deleted.ticketId }, "reservations");
    res.json({ success: true, message: "R\xE9servation supprim\xE9e avec succ\xE8s." });
  } catch (err) {
    console.error("Error deleting reservation from MongoDB:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});
router.post("/reservations/scan-verify", async (req, res) => {
  try {
    await connectMongoDB();
    const { rawCode, action } = req.body;
    if (!rawCode || !String(rawCode).trim()) {
      return res.status(400).json({ error: "Code scann\xE9 manquant." });
    }
    const cleanCode = String(rawCode).trim().toUpperCase();
    const reservation = await Reservation.findOne({
      $or: [
        { ticketId: cleanCode },
        { transactionId: cleanCode },
        { trackingRef: cleanCode }
      ]
    });
    if (!reservation) {
      return res.json({
        valid: false,
        status: "error_not_found",
        message: `Billet introuvable avec la r\xE9f\xE9rence : ${cleanCode}`
      });
    }
    if (reservation.status !== "VALIDATED") {
      return res.json({
        valid: false,
        status: "alert_unpaid",
        reservation,
        message: `Billet non valid\xE9 (Statut actuel : ${reservation.status}). Paiement requis avant embarquement.`
      });
    }
    if (reservation.isUsed) {
      return res.json({
        valid: false,
        status: "alert_reused",
        reservation,
        message: `Attention : ce billet (${reservation.ticketId}) a d\xE9j\xE0 \xE9t\xE9 compost\xE9 le ${reservation.usedAt?.toLocaleString("fr-FR")}.`
      });
    }
    if (action === "compost") {
      reservation.isUsed = true;
      reservation.usedAt = /* @__PURE__ */ new Date();
      await reservation.save();
      realtimeHub.emitEvent("reservation:composted", "composted", reservation, "reservations");
    }
    res.json({
      valid: true,
      status: "success",
      reservation,
      message: `Billet v\xE9rifi\xE9 avec succ\xE8s pour ${reservation.fullName} (${reservation.travelClass} - ${reservation.ship}).`
    });
  } catch (err) {
    console.error("Scan verification error in MongoDB:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});
router.get("/news", async (req, res) => {
  try {
    const newsList = await News.find().sort({ publishedAt: -1 }).limit(100);
    res.json(newsList);
  } catch (error) {
    console.error("Error fetching news from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors du chargement des actualit\xE9s." });
  }
});
router.get("/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const item = await News.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Article introuvable." });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du chargement de l'article." });
  }
});
router.post("/news", async (req, res) => {
  try {
    const { title, content, imageUrl, videoUrl, media, author } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Le titre et le contenu sont obligatoires." });
    }
    const newsItem = await News.create({
      title,
      content,
      imageUrl: imageUrl || "",
      videoUrl: videoUrl || "",
      media: media || [],
      author: author || "Direction AMR Mugote",
      views: 0,
      publishedAt: /* @__PURE__ */ new Date()
    });
    res.status(201).json(newsItem);
  } catch (error) {
    console.error("Error creating news in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la publication de l'article." });
  }
});
router.put("/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const newsItem = await News.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!newsItem) {
      return res.status(404).json({ error: "Article introuvable." });
    }
    res.json(newsItem);
  } catch (error) {
    console.error("Error updating news in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour de l'article." });
  }
});
router.delete("/news/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await News.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Article introuvable." });
    }
    await Comment.deleteMany({ newsId: id });
    res.json({ success: true, message: "Article supprim\xE9 avec succ\xE8s." });
  } catch (error) {
    console.error("Error deleting news from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'article." });
  }
});
router.post("/news/:id/views", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await News.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
    res.json({ views: updated?.views || 0 });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'incr\xE9mentation des vues." });
  }
});
router.get("/news/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await Comment.find({ newsId: id }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du chargement des commentaires." });
  }
});
router.post("/news/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userName, userAvatar, text } = req.body;
    if (!text || !userName) {
      return res.status(400).json({ error: "Le nom et le texte du commentaire sont obligatoires." });
    }
    const comment = await Comment.create({
      newsId: id,
      userId: userId || "",
      userName,
      userAvatar: userAvatar || "",
      text,
      createdAt: /* @__PURE__ */ new Date()
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error("Error adding comment in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de l'ajout du commentaire." });
  }
});
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ lastLogin: -1 });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors du chargement des utilisateurs." });
  }
});
router.post("/users/sync", async (req, res) => {
  try {
    const { uid, email, displayName, phone, photoURL, role, isVerified } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "UID utilisateur manquant." });
    }
    const user = await User.findOneAndUpdate(
      { uid },
      {
        $set: {
          email: email || "",
          displayName: displayName || "",
          phone: phone || "",
          photoURL: photoURL || "",
          isVerified: !!isVerified,
          lastLogin: /* @__PURE__ */ new Date(),
          ...role ? { role } : {}
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(user);
  } catch (error) {
    console.error("Error syncing user in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la synchronisation du compte." });
  }
});
router.put("/users/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOneAndUpdate(
      { uid },
      { $set: req.body },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }
    res.json(user);
  } catch (error) {
    console.error("Error updating user in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la mise \xE0 jour de l'utilisateur." });
  }
});
router.get("/conversations", async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { userId: String(userId) } : {};
    const conversations = await Conversation.find(filter).sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du chargement des conversations." });
  }
});
router.post("/conversations", async (req, res) => {
  try {
    const { userId, userName, userEmail, lastMessage } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId est requis." });
    }
    let conv = await Conversation.findOne({ userId, status: "OPEN" });
    if (!conv) {
      conv = await Conversation.create({
        userId,
        userName: userName || "Passager",
        userEmail: userEmail || "",
        lastMessage: lastMessage || "Nouvelle conversation",
        status: "OPEN",
        adminUnreadCount: 1
      });
    } else {
      conv.lastMessage = lastMessage || conv.lastMessage;
      conv.updatedAt = /* @__PURE__ */ new Date();
      conv.adminUnreadCount += 1;
      await conv.save();
    }
    res.json(conv);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la cr\xE9ation de la conversation." });
  }
});
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await Message.find({ conversationId: id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la r\xE9cup\xE9ration des messages." });
  }
});
router.post("/conversations/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const { text, senderId, senderRole } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Le texte du message est obligatoire." });
    }
    const message = await Message.create({
      conversationId: id,
      text,
      senderId: senderId || "",
      senderRole: senderRole || "USER",
      createdAt: /* @__PURE__ */ new Date()
    });
    await Conversation.findByIdAndUpdate(id, {
      $set: {
        lastMessage: text,
        updatedAt: /* @__PURE__ */ new Date()
      },
      $inc: { adminUnreadCount: senderRole === "USER" ? 1 : 0 }
    });
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'enregistrement du message." });
  }
});
router.post("/migrate/firestore-to-mongodb", async (req, res) => {
  try {
    const adminApp2 = admin2.apps.length ? admin2.apps[0] : admin2.initializeApp({ projectId: "mugote2" });
    const dbAdmin2 = getFirestore(adminApp2, "ai-studio-020b031e-1447-4f1b-8ef0-ab4a23c0b6ab");
    const stats = {
      settings: { migrated: 0, errors: 0 },
      schedules: { migrated: 0, errors: 0 },
      fleet: { migrated: 0, errors: 0 },
      news: { migrated: 0, errors: 0 },
      users: { migrated: 0, errors: 0 },
      reservations: { migrated: 0, errors: 0 }
    };
    console.log("\u{1F680} Starting non-destructive migration from Firestore to MongoDB Atlas...");
    try {
      const settingsSnap = await dbAdmin2.collection("settings").doc("site").get();
      if (settingsSnap.exists) {
        const data = settingsSnap.data() || {};
        await SiteSettings.findOneAndUpdate(
          { key: "site" },
          {
            $set: {
              homeBg: data.homeBg || "",
              homeDetail: data.homeDetail || "",
              adminCode: data.adminCode || "MUGOTE2025",
              contactPhone: data.contactPhone || "+243 994 286 469",
              classPrices: data.classPrices || { VIP: 27, "1\xE8re Classe": 27, "2\xE8me Classe": 17, "3\xE8me Classe": 10 },
              updatedAt: /* @__PURE__ */ new Date()
            }
          },
          { upsert: true }
        );
        stats.settings.migrated++;
      }
    } catch (e) {
      console.warn("Migration settings warning:", e);
      stats.settings.errors++;
    }
    try {
      const schedSnap = await dbAdmin2.collection("schedules").get();
      for (const doc of schedSnap.docs) {
        const d = doc.data();
        await Schedule.findOneAndUpdate(
          { firestoreId: doc.id },
          {
            $set: {
              firestoreId: doc.id,
              from: d.from || "Bukavu",
              to: d.to || "Goma",
              time: d.time || "07h30",
              ship: d.ship || "Mugote 1",
              days: d.days || "Tous les jours"
            }
          },
          { upsert: true }
        );
        stats.schedules.migrated++;
      }
    } catch (e) {
      console.warn("Migration schedules warning:", e);
      stats.schedules.errors++;
    }
    try {
      const fleetSnap = await dbAdmin2.collection("fleet").get();
      for (const doc of fleetSnap.docs) {
        const d = doc.data();
        await Boat.findOneAndUpdate(
          { firestoreId: doc.id },
          {
            $set: {
              firestoreId: doc.id,
              name: d.name || "Mugote",
              capacity: Number(d.capacity || 120),
              description: d.description || "",
              imageUrl: d.imageUrl || "",
              gallery: d.gallery || [],
              status: d.status || "ACTIF"
            }
          },
          { upsert: true }
        );
        stats.fleet.migrated++;
      }
    } catch (e) {
      console.warn("Migration fleet warning:", e);
      stats.fleet.errors++;
    }
    try {
      const newsSnap = await dbAdmin2.collection("news").get();
      for (const doc of newsSnap.docs) {
        const d = doc.data();
        await News.findOneAndUpdate(
          { firestoreId: doc.id },
          {
            $set: {
              firestoreId: doc.id,
              title: d.title || "Actualit\xE9 AMR Mugote",
              content: d.content || "",
              imageUrl: d.imageUrl || "",
              videoUrl: d.videoUrl || "",
              media: d.media || [],
              author: d.author || "Direction AMR Mugote",
              views: Number(d.views || 0),
              publishedAt: d.publishedAt?.toDate ? d.publishedAt.toDate() : /* @__PURE__ */ new Date()
            }
          },
          { upsert: true }
        );
        stats.news.migrated++;
      }
    } catch (e) {
      console.warn("Migration news warning:", e);
      stats.news.errors++;
    }
    try {
      const usersSnap = await dbAdmin2.collection("users").get();
      for (const doc of usersSnap.docs) {
        const d = doc.data();
        await User.findOneAndUpdate(
          { uid: d.uid || doc.id },
          {
            $set: {
              firestoreId: doc.id,
              uid: d.uid || doc.id,
              email: d.email || "",
              displayName: d.displayName || d.name || "",
              phone: d.phone || "",
              role: d.role || "CLIENT",
              isVerified: !!d.isVerified
            }
          },
          { upsert: true }
        );
        stats.users.migrated++;
      }
    } catch (e) {
      console.warn("Migration users warning:", e);
      stats.users.errors++;
    }
    try {
      const resSnap = await dbAdmin2.collection("reservations").get();
      for (const doc of resSnap.docs) {
        const d = doc.data();
        await Reservation.findOneAndUpdate(
          { firestoreId: doc.id },
          {
            $set: {
              firestoreId: doc.id,
              ticketId: d.ticketId || `AMR-${doc.id.substring(0, 6).toUpperCase()}`,
              fullName: d.fullName || "Passager",
              lastName: d.lastName || "",
              phone: d.phone || "",
              email: d.email || "",
              itinerary: d.itinerary || "Bukavu-Goma",
              ship: d.ship || "Mugote 1",
              travelDate: d.travelDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
              departureTime: d.departureTime || "07h30",
              travelClass: d.travelClass || "2\xE8me Classe",
              passengersCount: Number(d.passengersCount || 1),
              status: d.status || "PENDING",
              paymentMethod: d.paymentMethod || "Mobile Money",
              transactionId: d.transactionId || "",
              amount: Number(d.amount || 20),
              userId: d.userId || "",
              isUsed: !!d.isUsed,
              validatedAt: d.validatedAt ? d.validatedAt.toDate ? d.validatedAt.toDate() : new Date(d.validatedAt) : void 0,
              createdAt: d.createdAt ? d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt) : /* @__PURE__ */ new Date()
            }
          },
          { upsert: true }
        );
        stats.reservations.migrated++;
      }
    } catch (e) {
      console.warn("Migration reservations warning:", e);
      stats.reservations.errors++;
    }
    res.json({
      success: true,
      message: "Migration de Firestore vers MongoDB Atlas effectu\xE9e avec succ\xE8s sans suppression de donn\xE9es.",
      stats
    });
  } catch (error) {
    console.error("Migration fatal error:", error);
    res.status(500).json({ error: "Erreur lors de la migration des donn\xE9es.", details: error?.message });
  }
});
function parseToDate(val) {
  if (!val) return void 0;
  if (val instanceof Date) return isNaN(val.getTime()) ? void 0 : val;
  if (typeof val === "object") {
    if ("seconds" in val && typeof val.seconds === "number") {
      return new Date(val.seconds * 1e3);
    }
    if ("_seconds" in val && typeof val._seconds === "number") {
      return new Date(val._seconds * 1e3);
    }
  }
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? void 0 : d;
  }
  return void 0;
}
router.post("/sync/item", async (req, res) => {
  try {
    const isConnected = await connectMongoDB();
    if (!isConnected) {
      return res.status(503).json({
        error: "Connexion MongoDB Atlas impossible",
        details: "V\xE9rifiez la variable MONGODB_URI et les autorisations r\xE9seau (0.0.0.0/0) dans MongoDB Atlas."
      });
    }
    const { type, data } = req.body || {};
    if (!type || !data) {
      return res.status(400).json({ error: "Type et donn\xE9es de l'\xE9l\xE9ment obligatoires." });
    }
    let resultId = data.id || data._id || "";
    switch (type) {
      case "settings": {
        const updated = await SiteSettings.findOneAndUpdate(
          { key: "site" },
          {
            $set: {
              homeBg: data.homeBg || "",
              homeDetail: data.homeDetail || "",
              adminCode: data.adminCode || "MUGOTE2025",
              contactPhone: data.contactPhone || "+243 994 286 469",
              classPrices: data.classPrices || { VIP: 27, "1\xE8re Classe": 27, "2\xE8me Classe": 17, "3\xE8me Classe": 10 },
              updatedAt: /* @__PURE__ */ new Date()
            }
          },
          { upsert: true, new: true }
        );
        resultId = updated?._id?.toString() || "site";
        break;
      }
      case "schedule": {
        const depTime = data.departureTime || data.time || "07h30";
        const itin = data.itinerary || (data.from && data.to ? `${data.from}-${data.to}` : "Bukavu-Goma");
        const shipName = data.ship || "Mugote 1";
        let existingSched = null;
        if (data.id) {
          existingSched = await Schedule.findOne({ firestoreId: data.id });
        }
        if (!existingSched) {
          existingSched = await Schedule.findOne({ departureTime: depTime, itinerary: itin, ship: shipName });
        }
        const schedFields = {
          firestoreId: data.id || void 0,
          ship: shipName,
          departureTime: depTime,
          time: depTime,
          itinerary: itin,
          from: data.from || itin.split("-")[0] || "Bukavu",
          to: data.to || itin.split("-")[1] || "Goma",
          frequency: data.frequency || "Quotidien",
          days: Array.isArray(data.days) ? data.days : ["Tous les jours"],
          isActive: data.isActive !== false
        };
        let updated;
        if (existingSched) {
          updated = await Schedule.findByIdAndUpdate(existingSched._id, { $set: schedFields }, { new: true });
        } else {
          updated = await Schedule.create(schedFields);
        }
        resultId = updated?._id?.toString() || data.id;
        break;
      }
      case "boat":
      case "fleet": {
        let existingBoat = null;
        if (data.id) {
          existingBoat = await Boat.findOne({ firestoreId: data.id });
        }
        if (!existingBoat && data.name) {
          existingBoat = await Boat.findOne({ name: data.name });
        }
        const boatData = {
          firestoreId: data.id,
          name: data.name || "Mugote",
          capacity: Number(data.capacity || 150),
          description: data.description || "",
          imageUrl: data.imageUrl || "",
          gallery: Array.isArray(data.gallery) ? data.gallery : [],
          status: data.status || "ACTIF"
        };
        let updated;
        if (existingBoat) {
          updated = await Boat.findByIdAndUpdate(existingBoat._id, { $set: boatData }, { new: true });
        } else {
          updated = await Boat.create(boatData);
        }
        resultId = updated?._id?.toString() || data.id;
        break;
      }
      case "news": {
        let existingNews = null;
        if (data.id) {
          existingNews = await News.findOne({ firestoreId: data.id });
        }
        if (!existingNews && data.title) {
          existingNews = await News.findOne({ title: data.title });
        }
        const newsFields = {
          firestoreId: data.id,
          title: data.title || "Actualit\xE9 AMR Mugote",
          content: data.content || "",
          imageUrl: data.imageUrl || "",
          videoUrl: data.videoUrl || "",
          media: Array.isArray(data.media) ? data.media : [],
          author: data.author || "Direction AMR Mugote",
          views: Number(data.views || 0),
          publishedAt: parseToDate(data.publishedAt) || /* @__PURE__ */ new Date()
        };
        let updated;
        if (existingNews) {
          updated = await News.findByIdAndUpdate(existingNews._id, { $set: newsFields }, { new: true });
        } else {
          updated = await News.create(newsFields);
        }
        resultId = updated?._id?.toString() || data.id;
        break;
      }
      case "user": {
        const rawUid = String(data.uid || data.id || data.phone || "").trim();
        const uid = rawUid || `usr_${new mongoose12.Types.ObjectId()}`;
        const normalizedRole = (() => {
          const r = String(data.role || "").toUpperCase();
          if (r.includes("ADMIN")) return "ADMIN";
          if (r.includes("STAFF")) return "STAFF";
          return "CLIENT";
        })();
        let existingUser = null;
        if (data.id) {
          existingUser = await User.findOne({ $or: [{ firestoreId: data.id }, { uid }] });
        } else if (uid) {
          existingUser = await User.findOne({ uid });
        }
        const userFields = {
          firestoreId: data.id || uid,
          uid,
          email: data.email || "",
          displayName: data.displayName || data.name || data.fullName || "Passager",
          phone: data.phone || data.telephone || data.tel || "",
          photoURL: data.photoURL || "",
          role: normalizedRole,
          isVerified: !!data.isVerified,
          totalBookings: Number(data.totalBookings || data.bookingsCount || 0),
          totalSpent: Number(data.totalSpent || 0),
          lastLogin: parseToDate(data.lastLogin) || /* @__PURE__ */ new Date()
        };
        let updated;
        if (existingUser) {
          updated = await User.findByIdAndUpdate(existingUser._id, { $set: userFields }, { new: true });
        } else {
          updated = await User.create(userFields);
        }
        resultId = updated?._id?.toString() || uid;
        break;
      }
      case "reservation": {
        const ticketId = String(data.ticketId || "").trim() || `AMR-${(data.id || Math.random().toString(36).substring(2, 8)).substring(0, 6).toUpperCase()}`;
        const phone = String(data.phone || data.telephone || data.tel || "").trim() || "N/A";
        const fullName = String(data.fullName || data.nom || data.name || "Passager").trim();
        const travelDate = String(data.travelDate || data.date || "").trim() || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const travelClass = data.travelClass || data.classe || "2\xE8me Classe";
        const rawCount = Number(data.passengersCount ?? data.places ?? data.nbrPassagers ?? 1);
        const passengersCount = isNaN(rawCount) || rawCount < 1 ? 1 : rawCount;
        const rawAmount = Number(data.amount ?? data.prix ?? data.price ?? data.totalAmount ?? 20);
        const amount = isNaN(rawAmount) ? 20 : rawAmount;
        const normalizedStatus = (() => {
          const s = String(data.status || "").toUpperCase();
          if (s.includes("VALID") || s.includes("CONFIRM")) return "VALIDATED";
          if (s.includes("REJECT") || s.includes("REFUS")) return "REJECTED";
          if (s.includes("CANCEL") || s.includes("ANNUL")) return "CANCELLED";
          return "PENDING";
        })();
        let existingRes = null;
        if (data.id) {
          existingRes = await Reservation.findOne({ firestoreId: data.id });
        }
        if (!existingRes && ticketId) {
          existingRes = await Reservation.findOne({ ticketId });
        }
        const resFields = {
          firestoreId: data.id || void 0,
          ticketId,
          fullName,
          lastName: data.lastName || "",
          phone,
          email: data.email || "",
          itinerary: data.itinerary || (data.from && data.to ? `${data.from}-${data.to}` : "Bukavu-Goma"),
          ship: data.ship || "Mugote 1",
          travelDate,
          departureTime: data.departureTime || data.time || "07h30",
          travelClass,
          passengersCount,
          passengersList: Array.isArray(data.passengersList) ? data.passengersList : [],
          status: normalizedStatus,
          paymentMethod: data.paymentMethod || "Mobile Money",
          transactionId: data.transactionId || "",
          trackingRef: data.trackingRef || "",
          amount,
          currency: data.currency || "USD",
          userId: data.userId || "",
          notes: data.notes || "",
          isUsed: !!data.isUsed,
          usedAt: parseToDate(data.usedAt),
          validatedAt: parseToDate(data.validatedAt),
          cancellationStatus: data.cancellationStatus || void 0,
          cancellationProcessedAt: parseToDate(data.cancellationProcessedAt),
          createdAt: parseToDate(data.createdAt) || /* @__PURE__ */ new Date()
        };
        let updated;
        if (existingRes) {
          updated = await Reservation.findByIdAndUpdate(existingRes._id, { $set: resFields }, { new: true });
        } else {
          updated = await Reservation.create(resFields);
        }
        resultId = updated?._id?.toString() || ticketId;
        try {
          realtimeHub.emitEvent("reservation:synced", "synced", updated, "reservations");
        } catch (emitErr) {
        }
        break;
      }
      default:
        return res.status(400).json({ error: `Type non support\xE9 : ${type}` });
    }
    res.json({ success: true, type, id: resultId, message: "\xC9l\xE9ment synchronis\xE9 dans MongoDB Atlas." });
  } catch (err) {
    console.error("Single item sync error in MongoDB:", err);
    res.status(500).json({
      error: err.message || "Erreur lors de la synchronisation de l'\xE9l\xE9ment",
      details: err.stack || String(err)
    });
  }
});
router.post("/migrate/batch", async (req, res) => {
  try {
    const isConnected = await connectMongoDB();
    if (!isConnected) {
      return res.status(503).json({
        error: "Connexion MongoDB Atlas impossible",
        details: "Assurez-vous que la variable MONGODB_URI est configur\xE9e dans Vercel (Settings > Environment Variables) et que l'IP 0.0.0.0/0 est autoris\xE9e dans MongoDB Atlas (Network Access)."
      });
    }
    const { settings, schedules, fleet, news, users, reservations } = req.body || {};
    const stats = {
      settings: { migrated: 0, errors: 0 },
      schedules: { migrated: 0, errors: 0 },
      fleet: { migrated: 0, errors: 0 },
      news: { migrated: 0, errors: 0 },
      users: { migrated: 0, errors: 0 },
      reservations: { migrated: 0, errors: 0 }
    };
    if (settings) {
      try {
        await SiteSettings.findOneAndUpdate(
          { key: "site" },
          {
            $set: {
              homeBg: settings.homeBg || "",
              homeDetail: settings.homeDetail || "",
              adminCode: settings.adminCode || "MUGOTE2025",
              contactPhone: settings.contactPhone || "+243 994 286 469",
              classPrices: settings.classPrices || { VIP: 27, "1\xE8re Classe": 27, "2\xE8me Classe": 17, "3\xE8me Classe": 10 },
              updatedAt: /* @__PURE__ */ new Date()
            }
          },
          { upsert: true }
        );
        stats.settings.migrated++;
      } catch (e) {
        console.warn("Batch migrate settings error:", e);
        stats.settings.errors++;
      }
    }
    if (Array.isArray(schedules)) {
      for (const item of schedules) {
        try {
          const depTime = item.departureTime || item.time || "07h30";
          const itin = item.itinerary || (item.from && item.to ? `${item.from}-${item.to}` : "Bukavu-Goma");
          const shipName = item.ship || "Mugote 1";
          const query = item.id ? { firestoreId: item.id } : { departureTime: depTime, itinerary: itin, ship: shipName };
          await Schedule.findOneAndUpdate(
            query,
            {
              $set: {
                firestoreId: item.id || void 0,
                ship: shipName,
                departureTime: depTime,
                time: depTime,
                itinerary: itin,
                from: item.from || itin.split("-")[0] || "Bukavu",
                to: item.to || itin.split("-")[1] || "Goma",
                frequency: item.frequency || "Quotidien",
                days: item.days || ["Tous les jours"],
                isActive: item.isActive !== false
              }
            },
            { upsert: true, new: true }
          );
          stats.schedules.migrated++;
        } catch (e) {
          console.warn("Schedule migration item error:", e);
          stats.schedules.errors++;
        }
      }
    }
    if (Array.isArray(fleet)) {
      for (const item of fleet) {
        try {
          await Boat.findOneAndUpdate(
            { $or: [{ firestoreId: item.id }, { name: item.name }] },
            {
              $set: {
                firestoreId: item.id,
                name: item.name || "Mugote",
                capacity: Number(item.capacity || 120),
                description: item.description || "",
                imageUrl: item.imageUrl || "",
                gallery: item.gallery || [],
                status: item.status || "ACTIF"
              }
            },
            { upsert: true }
          );
          stats.fleet.migrated++;
        } catch (e) {
          stats.fleet.errors++;
        }
      }
    }
    if (Array.isArray(news)) {
      for (const item of news) {
        try {
          await News.findOneAndUpdate(
            { firestoreId: item.id },
            {
              $set: {
                firestoreId: item.id,
                title: item.title || "Actualit\xE9 AMR Mugote",
                content: item.content || "",
                imageUrl: item.imageUrl || "",
                videoUrl: item.videoUrl || "",
                media: item.media || [],
                author: item.author || "Direction AMR Mugote",
                views: Number(item.views || 0),
                publishedAt: parseToDate(item.publishedAt) || /* @__PURE__ */ new Date()
              }
            },
            { upsert: true }
          );
          stats.news.migrated++;
        } catch (e) {
          stats.news.errors++;
        }
      }
    }
    if (Array.isArray(users)) {
      for (const item of users) {
        try {
          const rawUid = String(item.uid || item.id || item.phone || "").trim();
          const uid = rawUid || `usr_${new mongoose12.Types.ObjectId()}`;
          const normalizedRole = (() => {
            const r = String(item.role || "").toUpperCase();
            if (r.includes("ADMIN")) return "ADMIN";
            if (r.includes("STAFF")) return "STAFF";
            return "CLIENT";
          })();
          let existingUser = null;
          if (item.id) {
            existingUser = await User.findOne({ $or: [{ firestoreId: item.id }, { uid }] });
          } else if (uid) {
            existingUser = await User.findOne({ uid });
          }
          const userFields = {
            firestoreId: item.id || uid,
            uid,
            email: item.email || "",
            displayName: item.displayName || item.name || item.fullName || "Passager",
            phone: item.phone || item.telephone || item.tel || "",
            photoURL: item.photoURL || "",
            role: normalizedRole,
            isVerified: !!item.isVerified,
            totalBookings: Number(item.totalBookings || item.bookingsCount || 0),
            totalSpent: Number(item.totalSpent || 0),
            lastLogin: parseToDate(item.lastLogin) || /* @__PURE__ */ new Date()
          };
          if (existingUser) {
            await User.findByIdAndUpdate(existingUser._id, { $set: userFields }, { new: true });
          } else {
            await User.create(userFields);
          }
          stats.users.migrated++;
        } catch (e) {
          console.warn("User migration item error:", e);
          stats.users.errors++;
        }
      }
    }
    if (Array.isArray(reservations)) {
      for (const item of reservations) {
        try {
          const ticketId = String(item.ticketId || "").trim() || `AMR-${(item.id || Math.random().toString(36).substring(2, 8)).substring(0, 6).toUpperCase()}`;
          const phone = String(item.phone || item.telephone || item.tel || "").trim() || "N/A";
          const fullName = String(item.fullName || item.nom || item.name || "Passager").trim();
          const travelDate = String(item.travelDate || item.date || "").trim() || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const travelClass = item.travelClass || item.classe || "2\xE8me Classe";
          const rawCount = Number(item.passengersCount ?? item.places ?? item.nbrPassagers ?? 1);
          const passengersCount = isNaN(rawCount) || rawCount < 1 ? 1 : rawCount;
          const rawAmount = Number(item.amount ?? item.prix ?? item.price ?? item.totalAmount ?? 20);
          const amount = isNaN(rawAmount) ? 20 : rawAmount;
          const normalizedStatus = (() => {
            const s = String(item.status || "").toUpperCase();
            if (s.includes("VALID") || s.includes("CONFIRM")) return "VALIDATED";
            if (s.includes("REJECT") || s.includes("REFUS")) return "REJECTED";
            if (s.includes("CANCEL") || s.includes("ANNUL")) return "CANCELLED";
            return "PENDING";
          })();
          let existingRes = null;
          if (item.id) {
            existingRes = await Reservation.findOne({ firestoreId: item.id });
          }
          if (!existingRes && ticketId) {
            existingRes = await Reservation.findOne({ ticketId });
          }
          const resFields = {
            firestoreId: item.id || void 0,
            ticketId,
            fullName,
            lastName: item.lastName || "",
            phone,
            email: item.email || "",
            itinerary: item.itinerary || (item.from && item.to ? `${item.from}-${item.to}` : "Bukavu-Goma"),
            ship: item.ship || "Mugote 1",
            travelDate,
            departureTime: item.departureTime || item.time || "07h30",
            travelClass,
            passengersCount,
            passengersList: Array.isArray(item.passengersList) ? item.passengersList : [],
            status: normalizedStatus,
            paymentMethod: item.paymentMethod || "Mobile Money",
            transactionId: item.transactionId || "",
            trackingRef: item.trackingRef || "",
            amount,
            currency: item.currency || "USD",
            userId: item.userId || "",
            notes: item.notes || "",
            isUsed: !!item.isUsed,
            usedAt: parseToDate(item.usedAt),
            validatedAt: parseToDate(item.validatedAt),
            cancellationStatus: item.cancellationStatus || void 0,
            cancellationProcessedAt: parseToDate(item.cancellationProcessedAt),
            createdAt: parseToDate(item.createdAt) || /* @__PURE__ */ new Date()
          };
          if (existingRes) {
            await Reservation.findByIdAndUpdate(existingRes._id, { $set: resFields }, { new: true });
          } else {
            await Reservation.create(resFields);
          }
          stats.reservations.migrated++;
        } catch (e) {
          console.warn("Reservation migration item error:", e);
          stats.reservations.errors++;
        }
      }
    }
    res.json({
      success: true,
      message: "Synchronisation par lot effectu\xE9e avec succ\xE8s dans MongoDB Atlas.",
      stats
    });
  } catch (error) {
    console.error("Batch migration fatal error:", error);
    res.status(500).json({ error: "Erreur lors de la synchronisation par lot.", details: error?.message });
  }
});
var api_default = router;

// server/app.ts
import admin3 from "firebase-admin";
import { getFirestore as getFirestore2 } from "firebase-admin/firestore";
var firebaseConfig = {
  projectId: "mugote2",
  databaseId: "ai-studio-020b031e-1447-4f1b-8ef0-ab4a23c0b6ab"
};
var adminApp = admin3.apps.length ? admin3.apps[0] : admin3.initializeApp({
  projectId: firebaseConfig.projectId
});
var dbAdmin = getFirestore2(adminApp, firebaseConfig.databaseId);
async function generateUniqueTicketId2() {
  let uniqueTicketId = "";
  let isUnique = false;
  let attempts = 0;
  const reservationsCol = dbAdmin.collection("reservations");
  while (!isUnique && attempts < 15) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    uniqueTicketId = `AMR-${randomHex}`;
    try {
      const mongoExists = await Reservation.findOne({ ticketId: uniqueTicketId });
      if (mongoExists) {
        attempts++;
        continue;
      }
    } catch (mErr) {
    }
    try {
      const qSnap = await reservationsCol.where("ticketId", "==", uniqueTicketId).get();
      if (qSnap.empty) {
        isUnique = true;
      }
    } catch (fErr) {
      isUnique = true;
    }
    attempts++;
  }
  if (!uniqueTicketId) {
    uniqueTicketId = `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  return uniqueTicketId;
}
function createExpressApp() {
  const app2 = express();
  app2.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
  }));
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app2.use(async (req, res, next) => {
    try {
      await connectMongoDB();
    } catch (err) {
    }
    next();
  });
  app2.use("/api", api_default);
  app2.use(api_default);
  app2.post(["/api/chat", "/chat"], async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message || !String(message).trim()) {
        return res.status(400).json({ error: "Le message est requis." });
      }
      let sitePrices = { "VIP": 27, "1\xE8re Classe": 27, "2\xE8me Classe": 17, "3\xE8me Classe": 10 };
      let sitePhone = "+243 994 286 469";
      try {
        const settingsSnap = await dbAdmin.collection("settings").doc("site").get();
        if (settingsSnap.exists) {
          const sData = settingsSnap.data();
          if (sData?.classPrices) {
            sitePrices = {
              "VIP": Number(sData.classPrices["VIP"] ?? 27),
              "1\xE8re Classe": Number(sData.classPrices["1\xE8re Classe"] ?? 27),
              "2\xE8me Classe": Number(sData.classPrices["2\xE8me Classe"] ?? 17),
              "3\xE8me Classe": Number(sData.classPrices["3\xE8me Classe"] ?? 10)
            };
          }
          if (sData?.contactPhone) {
            sitePhone = sData.contactPhone;
          }
        }
      } catch (dbErr) {
        console.warn("Could not load Firestore settings for chat, trying MongoDB:", dbErr);
        try {
          const mongoSet = await SiteSettings.findOne({ key: "site" });
          if (mongoSet && mongoSet.classPrices) {
            sitePrices = {
              "VIP": Number(mongoSet.classPrices.VIP ?? 27),
              "1\xE8re Classe": Number(mongoSet.classPrices["1\xE8re Classe"] ?? 27),
              "2\xE8me Classe": Number(mongoSet.classPrices["2\xE8me Classe"] ?? 17),
              "3\xE8me Classe": Number(mongoSet.classPrices["3\xE8me Classe"] ?? 10)
            };
          }
          if (mongoSet?.contactPhone) {
            sitePhone = mongoSet.contactPhone;
          }
        } catch (mErr) {
        }
      }
      const systemInstruction = `Tu es l'assistant IA officiel, expert et d\xE9vou\xE9 de "ETS AMR MUGOTE ET SES FRERES", la plateforme leader et r\xE9f\xE9rence du transport lacustre moderne sur le Lac Kivu en R\xE9publique D\xE9mocratique du Congo (RDC).
Ta mission est d'orienter, renseigner et accompagner chaleureusement les voyageurs \xE0 chaque \xE9tape de leur parcours.

=== CONNAISSANCES OFFICIELLES & EXHAUSTIVES DE LA PLATEFORME ===

1. IDENTIT\xC9 & MISSION DE L'ENTREPRISE :
- Raison sociale : ETS AMR MUGOTE ET SES FRERES (abr\xE9g\xE9 "AMR MUGOTE" ou "MUGOTE").
- Slogan : "Voyager en toute s\xE9curit\xE9".
- Rayonnement : Liaisons r\xE9guli\xE8res et rapides entre les villes de Bukavu (Sud-Kivu) et Goma (Nord-Kivu) via le Lac Kivu.
- Valeurs fondamentales : S\xE9curit\xE9 maritime certifi\xE9e, ponctualit\xE9, confort moderne, innovations technologiques et service client attentionn\xE9.

2. FLOTTE DE BATEAUX & S\xC9CURIT\xC9 :
- Nos navires rapides : MUGOTE 1, MUGOTE 2 et MUGOTE 3.
- Caract\xE9ristiques : Moteurs marins inspect\xE9s quotidiennement, gilets de sauvetage certifi\xE9s pour 100% des passagers, canots de sauvetage, radars GPS de navigation, extincteurs, si\xE8ges ergonomiques, \xE9crans de divertissement et pont panoramique offrant une vue splendide sur le Lac Kivu et l'\xEEle d'Idjwi.
- Dur\xE9e de travers\xE9e : Environ 3 heures de voyage agr\xE9able et s\xE9curis\xE9.

3. HORAIRES DE D\xC9PART QUOTIDIENS (7j/7) :
- Liaisons dans les 2 sens (Bukavu -> Goma ET Goma -> Bukavu) :
  \u2022 Matin : 07h30 (Mugote 1 / Mugote 2)
  \u2022 Midi : 11h00 (Mugote 2 / Mugote 3)
  \u2022 Apr\xE8s-midi : 14h30 (Mugote 3 / Mugote 1)
- Recommandation d'embarquement : Se pr\xE9senter au port d'embarquement 45 minutes avant le d\xE9part pour l'enregistrement et le contr\xF4le des billets.

4. GRILLE TARIFAIRE OFFICIELLE PAR CLASSE (ACTUALIS\xC9E EN DIRECT) :
- Classe VIP : ${sitePrices["VIP"]}$ USD (Salon climatis\xE9 privatis\xE9, si\xE8ges grand luxe, service personnalis\xE9, boisson offerte, embarquement prioritaire).
- 1\xE8re Classe : ${sitePrices["1\xE8re Classe"]}$ USD (Fauteuils spacieux de premi\xE8re qualit\xE9, espace calme, vue panoramique, priorit\xE9).
- 2\xE8me Classe : ${sitePrices["2\xE8me Classe"]}$ USD (Standard tr\xE8s populaire, grand espace a\xE9r\xE9 et ventil\xE9, tr\xE8s appr\xE9ci\xE9 des voyageurs).
- 3\xE8me Classe : ${sitePrices["3\xE8me Classe"]}$ USD (Option \xE9conomique et abordable, acc\xE8s direct au pont avec vue sur le lac).

5. LOCALISATION EXACTE DES PORTS & G\xC9OLOCALISATION GPS :
- PORT DE BUKAVU (Port d'attache AMR Mugote) :
  \u2022 Adresse : R\xE9publique D\xE9mocratique du Congo, Province du Sud-Kivu, Ville de Bukavu, Commune de Kadutu, Avenue Michombero, Quartier Nkafu.
  \u2022 Rep\xE8res : Situ\xE9 en diagonale avec le c\xE9l\xE8bre march\xE9 Beach Muhanzi de Bukavu.
  \u2022 Limites physiques : Born\xE9 \xE0 l'EST par le march\xE9 Beach Muhanzi, et \xE0 l'OUEST par le port de l'ETS SILIMU.
- PORT DE GOMA :
  \u2022 Port public lacustre de Goma, au bord du Lac Kivu, proche du centre-ville.
- MODULE GPS DU SITE (Onglet "LOCALISATION") :
  \u2022 Les passagers peuvent cliquer sur "LOCALISATION" dans le menu pour afficher leur position GPS en temps r\xE9el, calculer la distance exacte restante jusqu'au port d'embarquement et lancer l'itin\xE9raire routier.

6. PROCESSUS DE R\xC9SERVATION & BILLETTERIE PAS-\xC0-PAS :
- \xC9tape 1 : Se rendre sur l'onglet "R\xC9SERVER" dans le menu du site.
- \xC9tape 2 : S\xE9lectionner l'itin\xE9raire (Bukavu->Goma ou Goma->Bukavu), la date de voyage souhait\xE9e, le bateau et la classe de voyage (VIP, 1\xE8re, 2\xE8me ou 3\xE8me).
- \xC9tape 3 : Renseigner les coordonn\xE9es du passager (Nom complet, T\xE9l\xE9phone valide).
- \xC9tape 4 : Paiement du billet :
  \u2022 Mobile Money Automatique (FlexPay) : M-Pesa (Vodacom), Airtel Money, Orange Money.
  \u2022 Transfert Mobile Money direct : Envoi au num\xE9ro officiel ${sitePhone} (Titulaire du compte : AMR MUGOTE), puis saisie de la r\xE9f\xE9rence/ID de transaction.
  \u2022 Carte bancaire (Visa/Mastercard) ou paiement direct au guichet du port.
- \xC9tape 5 : Acc\xE8s au Billet :
  \u2022 Une fois la r\xE9servation valid\xE9e, le billet \xE9lectronique avec son QR Code infalsifiable est disponible dans l'onglet "MES BILLETS".
  \u2022 L'utilisateur peut le t\xE9l\xE9charger en PDF ou l'imprimer. Le QR Code est scann\xE9 au port lors de l'embarquement.

7. AUTRES SECTIONS & FONCTIONNALIT\xC9S DU SITE :
- "GALERIE" : Photos et vid\xE9os de haute qualit\xE9 des bateaux, des cabines VIP et des travers\xE9es sur le Lac Kivu.
- "ACTUALIT\xC9S" (Journal de bord) : Publications officielles de la compagnie, informations m\xE9t\xE9o, annonces de trafic.
- "FAQ" : Foire aux questions d\xE9taill\xE9es.
- "MES BILLETS" : Visualisation, t\xE9l\xE9chargement PDF et v\xE9rification des r\xE9servations de l'utilisateur.
- "CONTACT" : Support et assistance client par t\xE9l\xE9phone / WhatsApp au ${sitePhone}.

8. R\xC8GLES DE BAGAGES & POLITIQUE DE VOYAGE :
- Bagages inclus : Valise standard + bagage \xE0 main inclus par passager.
- Colis et fret lourd : Pris en charge aux comptoirs de fret de nos ports \xE0 des tarifs avantageux.
- Enfants : Les enfants en bas \xE2ge voyagent accompagn\xE9s avec gilets de sauvetage adapt\xE9s.
- Animaux : Transport autoris\xE9 sous conditions strictes dans des cages adapt\xE9es et sur le pont.

=== CONSIGNES DE R\xC9PONSE ET DE COMPORTEMENT ===
- TON : Tr\xE8s courtois, professionnel, accueillant et chaleureux. Utilise toujours le vouvoiement ("Vous").
- LANGUE : R\xE9ponds en FRAN\xC7AIS (ou en Swahili / Lingala / Anglais si l'utilisateur s'exprime express\xE9ment dans ces langues).
- CLART\xC9 : Structure tes r\xE9ponses avec des puces claires, des sauts de ligne et du texte en gras pour une excellente lisibilit\xE9.
- ORIENTATION : Guide pr\xE9cis\xE9ment l'utilisateur vers le bon onglet du site (ex: "Cliquez sur l'onglet 'R\xC9SERVER' en haut de la page", "Rendez-vous dans la section 'LOCALISATION'", "Consultez vos billets dans 'MES BILLETS'").
- IDENTIT\xC9 IA : Tu es "Mugote AI Assistant", l'assistant virtuel intelligent de la compagnie maritime ETS AMR MUGOTE. Ne mentionne jamais que tu es un mod\xE8le g\xE9n\xE9rique de Google.`;
      const apiKey = process.env.GEMINI_API_KEY;
      const messageStr = String(message || "").trim();
      const rawContents = [];
      const historyItems = history || [];
      for (const h of historyItems) {
        const text = String(h.text || h.message || "").trim();
        if (!text) continue;
        const rName = (h.role || h.senderRole || "").toString().toUpperCase();
        const role = rName === "AI" || rName === "ADMIN" || rName === "MODEL" ? "model" : "user";
        rawContents.push({ role, parts: [{ text }] });
      }
      const lastHistoryMessage = rawContents.length > 0 ? rawContents[rawContents.length - 1].parts[0].text : "";
      if (lastHistoryMessage !== messageStr) {
        rawContents.push({ role: "user", parts: [{ text: messageStr }] });
      }
      const contents = [];
      for (const item of rawContents) {
        if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
          contents[contents.length - 1].parts[0].text += "\n" + item.parts[0].text;
        } else {
          contents.push(item);
        }
      }
      while (contents.length > 0 && contents[0].role !== "user") {
        contents.shift();
      }
      if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: messageStr }] });
      }
      if (apiKey) {
        const client = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        const candidateModels = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
        let responseText = "";
        for (const mName of candidateModels) {
          try {
            console.log(`Calling Gemini with model ${mName}...`);
            const result = await client.models.generateContent({
              model: mName,
              contents,
              config: {
                systemInstruction,
                temperature: 0.7
              }
            });
            if (result && result.text) {
              responseText = result.text;
              break;
            } else if (result && result.candidates?.[0]?.content?.parts?.[0]?.text) {
              responseText = result.candidates[0].content.parts[0].text;
              break;
            }
          } catch (modelCallErr) {
            console.warn(`Attempt with ${mName} failed:`, modelCallErr?.message || modelCallErr);
          }
        }
        if (responseText && responseText.trim()) {
          return res.json({ text: responseText });
        }
      }
      const q = messageStr.toLowerCase();
      let fallbackText = "";
      if (q.includes("tarif") || q.includes("prix") || q.includes("combien") || q.includes("co\xFBt") || q.includes("cout") || q.includes("classe")) {
        fallbackText = `\u{1F6A2} **Grille Tarifaire Officielle \u2014 AMR MUGOTE :**

\u2022 \u{1F451} **Classe VIP :** **${sitePrices["VIP"]}$ USD** (Salon climatis\xE9, grand confort, service personnalis\xE9, boisson offerte).
\u2022 \u2B50 **1\xE8re Classe :** **${sitePrices["1\xE8re Classe"]}$ USD** (Si\xE8ges grand confort, espace calme et vue panoramique).
\u2022 \u{1F6A2} **2\xE8me Classe :** **${sitePrices["2\xE8me Classe"]}$ USD** (Standard recommand\xE9, a\xE9r\xE9 et tr\xE8s spacieux).
\u2022 \u2693 **3\xE8me Classe :** **${sitePrices["3\xE8me Classe"]}$ USD** (Tarif \xE9conomique et abordable, acc\xE8s pont).

\u{1F4A1} *Pour r\xE9server, rendez-vous dans l'onglet **"R\xC9SERVER"** en haut de la plateforme.*`;
      } else if (q.includes("horaire") || q.includes("heure") || q.includes("d\xE9part") || q.includes("depart") || q.includes("quand")) {
        fallbackText = `\u{1F552} **Horaires de D\xE9parts Quotidiens (Bukavu <-> Goma) :**

Nos navires rapides assurent les liaisons tous les jours aux horaires suivants :
\u2022 **Matin :** **07h30** (Mugote 1 / Mugote 2)
\u2022 **Midi :** **11h00** (Mugote 2 / Mugote 3)
\u2022 **Apr\xE8s-midi :** **14h30** (Mugote 3 / Mugote 1)

\u23F1\uFE0F *Dur\xE9e de la travers\xE9e : environ 3 heures sur le Lac Kivu.*
\u{1F4CD} *Pr\xE9sentation au port recommand\xE9e : 45 minutes avant le d\xE9part.*`;
      } else if (q.includes("port") || q.includes("adresse") || q.includes("localisation") || q.includes("o\xF9") || q.includes("ou se trouve") || q.includes("kadutu") || q.includes("nkafu") || q.includes("beach")) {
        fallbackText = `\u{1F4CD} **Localisation de nos Ports d'Embarquement :**

\u2022 **Port de Bukavu :** Commune de Kadutu, Avenue Michombero, Quartier Nkafu (situ\xE9 en diagonale avec le c\xE9l\xE8bre march\xE9 Beach Muhanzi, born\xE9 \xE0 l'Ouest par le port ETS SILIMU).
\u2022 **Port de Goma :** Port public lacustre du Lac Kivu \xE0 Goma.

\u{1F5FA}\uFE0F *Astuce : Vous pouvez vous rendre sur l'onglet **"LOCALISATION"** de notre site pour visualiser votre position GPS en temps r\xE9el et obtenir l'itin\xE9raire exact.*`;
      } else if (q.includes("r\xE9serv") || q.includes("reserv") || q.includes("billet") || q.includes("ticket") || q.includes("comment")) {
        fallbackText = `\u{1F3AB} **Comment r\xE9server votre billet sur AMR MUGOTE :**

1. Cliquez sur l'onglet **"R\xC9SERVER"** dans le menu.
2. S\xE9lectionnez votre trajet (*Bukavu -> Goma* ou *Goma -> Bukavu*), la date, le navire et votre classe.
3. Saisissez vos coordonn\xE9es passager (Nom & T\xE9l\xE9phone).
4. Effectuez le paiement soit par **Mobile Money automatique (FlexPay)**, soit par transfert manuel au **${sitePhone}** (Titulaire : AMR MUGOTE).
5. Retrouvez votre billet s\xE9curis\xE9 avec QR Code dans l'onglet **"MES BILLETS"** pour l'embarquement.`;
      } else if (q.includes("paiement") || q.includes("payer") || q.includes("flexpay") || q.includes("airtel") || q.includes("mpesa") || q.includes("m-pesa") || q.includes("orange")) {
        fallbackText = `\u{1F4B3} **Modes de Paiement Accept\xE9s :**

\u2022 **Mobile Money Automatique :** Airtel Money, M-Pesa (Vodacom), Orange Money via FlexPay.
\u2022 **Paiement Mobile Money Direct :** Envoi au num\xE9ro officiel **${sitePhone}** (*Titulaire : AMR MUGOTE*).
\u2022 **Carte Bancaire :** Cartes Visa & Mastercard accept\xE9es.
\u2022 **Au Guichet :** R\xE8glement en esp\xE8ces directement \xE0 nos agences aux ports de Bukavu et Goma.`;
      } else if (q.includes("contact") || q.includes("num\xE9ro") || q.includes("numero") || q.includes("t\xE9l\xE9phone") || q.includes("telephone") || q.includes("whatsapp")) {
        fallbackText = `\u{1F4DE} **Contacts & Assistance Client AMR MUGOTE :**

\u2022 **T\xE9l\xE9phone / WhatsApp :** **${sitePhone}**
\u2022 **Service Client :** Disponible 7j/7 pour vos r\xE9servations et renseignements.
\u2022 **Guichets :** Pr\xE9sence physique aux ports de Bukavu (Beach Muhanzi) et Goma.`;
      } else {
        fallbackText = `\u{1F44B} **Bonjour et bienvenue \xE0 bord d'ETS AMR MUGOTE ET SES FRERES !**

Je suis votre assistant virtuel officiel. Je peux vous renseigner instantan\xE9ment sur :

\u2022 \u{1F4B3} **Les tarifs par classe** (VIP : ${sitePrices["VIP"]}$, 1\xE8re : ${sitePrices["1\xE8re Classe"]}$, 2\xE8me : ${sitePrices["2\xE8me Classe"]}$, 3\xE8me : ${sitePrices["3\xE8me Classe"]}$)
\u2022 \u{1F552} **Les horaires de d\xE9part quotidiens** (07h30, 11h00, 14h30)
\u2022 \u{1F4CD} **L'adresse et l'acc\xE8s au Port Mugote** (Bukavu / Goma & Guidage GPS)
\u2022 \u{1F3AB} **La r\xE9servation et le paiement de vos billets en ligne**
\u2022 \u{1F9F3} **Les conditions de voyage et la s\xE9curit\xE9 \xE0 bord**

N'h\xE9sitez pas \xE0 me poser votre question pr\xE9cise ou cliquez sur l'une des suggestions ci-dessous !`;
      }
      res.json({ text: fallbackText });
    } catch (error) {
      console.error("Gemini /api/chat error:", error);
      res.json({
        text: `Bienvenue chez ETS AMR MUGOTE ET SES FRERES ! Nous assurons les liaisons quotidiennes Bukavu-Goma \xE0 07h30, 11h00 et 14h30. Pour r\xE9server votre billet, cliquez sur l'onglet **"R\xC9SERVER"** ou contactez notre support au **+243 994 286 469**.`
      });
    }
  });
  app2.post(["/api/verify-payment", "/verify-payment"], async (req, res) => {
    const { transactionId, phone, amount } = req.body;
    console.log(`Verifying payment for transaction ${transactionId} from ${phone} for ${amount} FC`);
    res.json({ status: "initiated", message: "Paiement en attente de validation administrative." });
  });
  app2.post(["/api/flexpay/initialize", "/flexpay/initialize"], async (req, res) => {
    try {
      const { phone, amount, operator, reservationId } = req.body;
      if (!phone || !amount || !reservationId) {
        return res.status(400).json({ error: "Champs obligatoires manquants." });
      }
      const formattedPhone = phone.replace(/[\s\-\+]/g, "");
      const finalClientPhone = formattedPhone.startsWith("0") ? "243" + formattedPhone.substring(1) : formattedPhone.startsWith("243") ? formattedPhone : "243" + formattedPhone;
      const trackingRef = `AMR-FLX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      try {
        const docRef = dbAdmin.collection("reservations").doc(reservationId);
        await docRef.update({
          transactionId: trackingRef,
          momoOperator: operator || "Airtel Money"
        });
      } catch (dbErr) {
        console.warn("Could not write initial tracking ref to Firestore:", dbErr);
      }
      const apiToken = process.env.FLEXPAY_API_TOKEN;
      const merchantKey = process.env.FLEXPAY_MERCHANT_KEY;
      const recipientNumber = process.env.RECIPIENT_AIRTEL_NUMBER || "243994102673";
      if (!apiToken || !merchantKey) {
        return res.json({
          success: true,
          trackingRef,
          simulated: true,
          message: "Mode test d'\xE9valuation activ\xE9. USSD Push simul\xE9."
        });
      }
      const flexpayUrl = "https://gateway.flexpay.cd/api/1.0/pay";
      const payload = {
        merchant: merchantKey,
        phone: finalClientPhone,
        amount: String(amount),
        currency: "USD",
        reference: trackingRef,
        callback: `${process.env.APP_URL || "https://amr-mugote-et-ses-freres.vercel.app"}/api/flexpay/callback`,
        description: `Billet AMR MUGOTE - Cr\xE9dite: ${recipientNumber}`
      };
      const response = await fetch(flexpayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`
        },
        body: JSON.stringify(payload)
      });
      const responseData = await response.json();
      if (response.ok && (responseData.code === "0" || responseData.code === 0 || responseData.status === "0" || responseData.success)) {
        res.json({
          success: true,
          trackingRef,
          simulated: false,
          flexpayData: responseData,
          message: "Votre transaction a \xE9t\xE9 initi\xE9e. Veuillez saisir votre code secret sur le push USSD de votre t\xE9l\xE9phone."
        });
      } else {
        res.json({
          success: false,
          trackingRef,
          simulated: true,
          error: responseData.message || "\xC9chec de l'int\xE9gration avec le serveur FlexPay.",
          message: "Impossible d'initier un paiement r\xE9el. Passage automatique au mode Simulation d'\xE9valuation."
        });
      }
    } catch (error) {
      console.error("Critical error inside FlexPay initializer:", error);
      res.json({
        success: false,
        trackingRef: `SIM-ERR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        simulated: true,
        message: "Une erreur technique s'est produite lors de la connexion. Mode simulation activ\xE9 pour \xE9valuation."
      });
    }
  });
  app2.post(["/api/flexpay/callback", "/flexpay/callback"], async (req, res) => {
    try {
      console.log("FlexPay webhook callback triggered with body:", JSON.stringify(req.body));
      const { reference, status, code } = req.body;
      const referenceToUse = reference || req.body.ref || req.body.order_ref;
      const statusToUse = status !== void 0 ? status : code;
      if (!referenceToUse) {
        return res.status(400).json({ error: "Le param\xE8tre reference est obligatoire dans le callback." });
      }
      const isSuccess = String(statusToUse).trim() === "0" || String(statusToUse).toUpperCase() === "SUCCESSFUL" || String(statusToUse).toUpperCase() === "SUCCESS" || String(statusToUse).toUpperCase() === "COMPLETED";
      if (isSuccess) {
        console.log(`FlexPay Callback confirms successful transaction reference: ${referenceToUse}`);
        let uniqueTicketId = "";
        try {
          const mongoRes = await Reservation.findOne({
            $or: [{ transactionId: referenceToUse }, { trackingRef: referenceToUse }]
          });
          if (mongoRes && mongoRes.status !== "VALIDATED") {
            uniqueTicketId = await generateUniqueTicketId2();
            mongoRes.status = "VALIDATED";
            mongoRes.ticketId = uniqueTicketId;
            mongoRes.validatedAt = /* @__PURE__ */ new Date();
            await mongoRes.save();
            console.log(`[MongoDB] FlexPay validated ticket ${uniqueTicketId} for Mongo reservation ${mongoRes._id}`);
          } else if (mongoRes) {
            uniqueTicketId = mongoRes.ticketId || "";
          }
        } catch (mErr) {
          console.warn("MongoDB FlexPay update error:", mErr);
        }
        const reservationsCol = dbAdmin.collection("reservations");
        const querySnapshot = await reservationsCol.where("transactionId", "==", referenceToUse).get();
        if (!querySnapshot.empty) {
          for (const doc of querySnapshot.docs) {
            const reservationData = doc.data();
            if (reservationData.status !== "VALIDATED") {
              if (!uniqueTicketId) uniqueTicketId = await generateUniqueTicketId2();
              await doc.ref.update({
                status: "VALIDATED",
                ticketId: uniqueTicketId,
                validatedAt: Date.now()
              });
              console.log(`[Firestore] Successfully completed reservation callback for ${doc.id} giving active Ticket ${uniqueTicketId}`);
            }
          }
        }
      }
      res.status(200).send("OK");
    } catch (error) {
      console.error("Critical failure during callback webhook processing:", error);
      res.status(500).send("Callback error");
    }
  });
  app2.get(["/api/flexpay/check-status/:ref", "/flexpay/check-status/:ref"], async (req, res) => {
    try {
      const { ref } = req.params;
      try {
        const mongoRes = await Reservation.findOne({
          $or: [{ transactionId: ref }, { trackingRef: ref }]
        });
        if (mongoRes) {
          return res.json({
            found: true,
            validated: mongoRes.status === "VALIDATED",
            ticketId: mongoRes.ticketId || null,
            transactionId: mongoRes.transactionId || null,
            status: mongoRes.status
          });
        }
      } catch (mErr) {
      }
      const reservationsCol = dbAdmin.collection("reservations");
      const querySnapshot = await reservationsCol.where("transactionId", "==", ref).get();
      if (querySnapshot.empty) {
        return res.json({ found: false, validated: false });
      }
      const docVal = querySnapshot.docs[0];
      const data = docVal.data();
      res.json({
        found: true,
        validated: data.status === "VALIDATED",
        ticketId: data.ticketId || null,
        transactionId: data.transactionId || null,
        status: data.status
      });
    } catch (error) {
      console.error("Error checking transaction reference state:", error);
      res.status(500).json({ error: "Internal check failed" });
    }
  });
  app2.post(["/api/flexpay/simulate", "/flexpay/simulate"], async (req, res) => {
    try {
      const { trackingRef } = req.body;
      if (!trackingRef) {
        return res.status(400).json({ error: "trackingRef is required for sandbox simulation." });
      }
      try {
        const mongoRes = await Reservation.findOne({
          $or: [{ transactionId: trackingRef }, { trackingRef }]
        });
        if (mongoRes) {
          if (mongoRes.status !== "VALIDATED") {
            const uniqueTicketId = await generateUniqueTicketId2();
            mongoRes.status = "VALIDATED";
            mongoRes.ticketId = uniqueTicketId;
            mongoRes.validatedAt = /* @__PURE__ */ new Date();
            await mongoRes.save();
            return res.json({ success: true, ticketId: uniqueTicketId });
          }
          return res.json({ success: true, ticketId: mongoRes.ticketId, alreadyValidated: true });
        }
      } catch (mErr) {
      }
      const reservationsCol = dbAdmin.collection("reservations");
      const querySnapshot = await reservationsCol.where("transactionId", "==", trackingRef).get();
      if (!querySnapshot.empty) {
        const docVal = querySnapshot.docs[0];
        const reservationData = docVal.data();
        if (reservationData.status !== "VALIDATED") {
          const uniqueTicketId = await generateUniqueTicketId2();
          await docVal.ref.update({
            status: "VALIDATED",
            ticketId: uniqueTicketId,
            validatedAt: Date.now()
          });
          return res.json({ success: true, ticketId: uniqueTicketId });
        }
        return res.json({ success: true, ticketId: reservationData.ticketId, alreadyValidated: true });
      }
      res.status(404).json({ success: false, error: "R\xE9f\xE9rence introuvable." });
    } catch (error) {
      console.error("Bypass callback simulation failed:", error);
      res.status(500).json({ error: "Simulation trigger failed" });
    }
  });
  app2.get(["/api/config", "/config"], (req, res) => {
    res.json({
      merchantPhone: "+243994286469",
      merchantName: "AMR MUGOTE & FR\xC8RES"
    });
  });
  app2.get(["/api/debug-env", "/debug-env"], (req, res) => {
    const key = process.env.GEMINI_API_KEY;
    res.json({
      hasKey: !!key,
      keyLength: key ? key.length : 0,
      keyStart: key ? key.substring(0, 4) : "none",
      nodeEnv: process.env.NODE_ENV || "development"
    });
  });
  app2.get(["/api/sdd", "/sdd"], (req, res) => {
    try {
      const sddPath = path.join(process.cwd(), "SDD.md");
      if (fs.existsSync(sddPath)) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.sendFile(sddPath);
      }
      res.status(404).send("Document de Conception Syst\xE8me (SDD) introuvable.");
    } catch (err) {
      res.status(500).send("Erreur lors de la lecture du SDD: " + err.message);
    }
  });
  app2.get("/googlec0e88496e42691d5.html", (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send("google-site-verification: googlec0e88496e42691d5.html");
  });
  app2.get("/sitemap.xml", (req, res) => {
    try {
      const publicPath = path.join(process.cwd(), "public", "sitemap.xml");
      const distPath = path.join(process.cwd(), "dist", "sitemap.xml");
      let xmlContent = "";
      if (fs.existsSync(publicPath)) {
        xmlContent = fs.readFileSync(publicPath, "utf-8");
      } else if (fs.existsSync(distPath)) {
        xmlContent = fs.readFileSync(distPath, "utf-8");
      } else {
        const baseUrl = "https://amr-mugote-et-ses-freres.vercel.app";
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/?page=booking</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>
    <url>
        <loc>${baseUrl}/?page=news</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
    <url>
        <loc>${baseUrl}/?page=gallery</loc>
        <lastmod>${today}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
    <url>
        <loc>${baseUrl}/?page=map</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>`;
      }
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.send(xmlContent);
    } catch (err) {
      res.status(500).send("Erreur lors de la g\xE9n\xE9ration du sitemap: " + err.message);
    }
  });
  app2.get("/robots.txt", (req, res) => {
    try {
      const publicPath = path.join(process.cwd(), "public", "robots.txt");
      const distPath = path.join(process.cwd(), "dist", "robots.txt");
      let textContent = "";
      if (fs.existsSync(publicPath)) {
        textContent = fs.readFileSync(publicPath, "utf-8");
      } else if (fs.existsSync(distPath)) {
        textContent = fs.readFileSync(distPath, "utf-8");
      } else {
        textContent = "User-agent: *\nAllow: /\n\nSitemap: https://amr-mugote-et-ses-freres.vercel.app/sitemap.xml";
      }
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.send(textContent);
    } catch (err) {
      res.status(500).send("Erreur lors de la lecture de robots.txt: " + err.message);
    }
  });
  return app2;
}
var app = createExpressApp();
var app_default = app;

// server/vercel.ts
connectMongoDB().catch((err) => {
  console.warn("[Vercel Handler] Initial MongoDB connection notice:", err?.message || err);
});
function handler(req, res) {
  return app_default(req, res);
}
export {
  handler as default
};
