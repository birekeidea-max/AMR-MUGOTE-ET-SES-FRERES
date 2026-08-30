import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabaseStatus, connectMongoDB } from '../db';
import {
  SiteSettings,
  Schedule,
  Boat,
  Reservation,
  News,
  Comment,
  User,
  Conversation,
  Message
} from '../models';
import { optionalFirebaseAuth } from '../middleware/auth';

const router = Router();

// Helper to generate unique ticket ID (format: AMR-XXXXXX)
async function generateUniqueTicketId(): Promise<string> {
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

// -------------------------------------------------------------
// 1. HEALTH & DATABASE STATUS ROUTE
// -------------------------------------------------------------
router.get(['/health', '/status'], async (req: Request, res: Response) => {
  const dbStatus = getDatabaseStatus();
  let counts: Record<string, number> = {};

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
    server: 'ok',
    app: 'AMR MUGOTE ET SES FRÈRES',
    database: 'mongodb',
    databaseStatus: dbStatus.databaseStatus,
    isConnected: dbStatus.isConnected,
    dbName: dbStatus.dbName,
    lastError: dbStatus.lastError,
    counts,
    timestamp: new Date().toISOString()
  });
});

router.post('/reconnect', async (req: Request, res: Response) => {
  const success = await connectMongoDB();
  const dbStatus = getDatabaseStatus();
  res.json({
    success,
    status: dbStatus.databaseStatus,
    isConnected: dbStatus.isConnected,
    lastError: dbStatus.lastError
  });
});

// -------------------------------------------------------------
// 2. SITE SETTINGS & TARIFFS
// -------------------------------------------------------------
router.get('/settings', async (req: Request, res: Response) => {
  try {
    let settings = await SiteSettings.findOne({ key: 'site' });
    if (!settings) {
      settings = await SiteSettings.create({
        key: 'site',
        adminCode: 'MUGOTE2025',
        contactPhone: '+243 994 286 469',
        classPrices: {
          VIP: 27,
          '1ère Classe': 27,
          '2ème Classe': 17,
          '3ème Classe': 10
        }
      });
    }
    res.json(settings);
  } catch (error: any) {
    console.error("Error fetching settings from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des paramètres." });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const updateData = req.body;
    const settings = await SiteSettings.findOneAndUpdate(
      { key: 'site' },
      { $set: { ...updateData, updatedAt: new Date() } },
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (error: any) {
    console.error("Error updating settings in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour des paramètres." });
  }
});

// -------------------------------------------------------------
// 3. SCHEDULES (HORAIRES DE NAVIGATION)
// -------------------------------------------------------------
router.get('/schedules', async (req: Request, res: Response) => {
  try {
    const schedules = await Schedule.find().sort({ time: 1 });
    res.json(schedules);
  } catch (error: any) {
    console.error("Error fetching schedules from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors du chargement des horaires." });
  }
});

router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const { from, to, time, ship, days } = req.body;
    if (!from || !to || !time) {
      return res.status(400).json({ error: "Les champs provenance, destination et heure sont requis." });
    }
    const schedule = await Schedule.create({
      from,
      to,
      time,
      ship: ship || 'Mugote 1',
      days: days || 'Tous les jours'
    });
    res.status(201).json(schedule);
  } catch (error: any) {
    console.error("Error creating schedule in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la création de l'horaire." });
  }
});

router.put('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!schedule) {
      return res.status(404).json({ error: "Horaire introuvable." });
    }
    res.json(schedule);
  } catch (error: any) {
    console.error("Error updating schedule in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la modification de l'horaire." });
  }
});

router.delete('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Schedule.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Horaire introuvable." });
    }
    res.json({ success: true, message: "Horaire supprimé avec succès." });
  } catch (error: any) {
    console.error("Error deleting schedule from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'horaire." });
  }
});

// -------------------------------------------------------------
// 4. FLEET (BATEAUX)
// -------------------------------------------------------------
router.get('/fleet', async (req: Request, res: Response) => {
  try {
    const boats = await Boat.find().sort({ name: 1 });
    res.json(boats);
  } catch (error: any) {
    console.error("Error fetching fleet from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors du chargement de la flotte." });
  }
});

router.post('/fleet', async (req: Request, res: Response) => {
  try {
    const { name, capacity, description, imageUrl, gallery, status } = req.body;
    if (!name || !capacity) {
      return res.status(400).json({ error: "Le nom et la capacité du bateau sont requis." });
    }
    const boat = await Boat.create({
      name,
      capacity: Number(capacity),
      description: description || '',
      imageUrl: imageUrl || '',
      gallery: gallery || [],
      status: status || 'ACTIF'
    });
    res.status(201).json(boat);
  } catch (error: any) {
    console.error("Error creating boat in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du navire." });
  }
});

router.put('/fleet/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const boat = await Boat.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!boat) {
      return res.status(404).json({ error: "Navire introuvable." });
    }
    res.json(boat);
  } catch (error: any) {
    console.error("Error updating boat in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du navire." });
  }
});

router.delete('/fleet/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Boat.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Navire introuvable." });
    }
    res.json({ success: true, message: "Navire retiré de la flotte avec succès." });
  } catch (error: any) {
    console.error("Error deleting boat from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du navire." });
  }
});

// -------------------------------------------------------------
// 5. RESERVATIONS & BILLETTERIE (CRUD & SCAN VALIDATION)
// -------------------------------------------------------------
router.get('/reservations', async (req: Request, res: Response) => {
  try {
    const { userId, phone, status, travelDate, search, ticketId } = req.query;
    const filter: any = {};

    if (userId) filter.userId = userId;
    if (phone) filter.phone = phone;
    if (status) filter.status = status;
    if (travelDate) filter.travelDate = travelDate;
    if (ticketId) filter.ticketId = String(ticketId).trim().toUpperCase();

    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { phone: searchRegex },
        { ticketId: searchRegex },
        { transactionId: searchRegex }
      ];
    }

    const reservations = await Reservation.find(filter).sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error: any) {
    console.error("Error fetching reservations from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des réservations." });
  }
});

router.get('/reservations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let reservation = null;

    if (id.startsWith('AMR-')) {
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
      return res.status(404).json({ error: "Billet / Réservation introuvable." });
    }

    res.json(reservation);
  } catch (error: any) {
    console.error("Error fetching single reservation from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la recherche de la réservation." });
  }
});

router.post('/reservations', optionalFirebaseAuth, async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data.fullName || !data.phone || !data.itinerary || !data.travelDate || !data.travelClass) {
      return res.status(400).json({ error: "Informations de réservation incomplètes." });
    }

    // Generate unique Ticket ID if validated or in progress
    let ticketId = data.ticketId;
    if (!ticketId || !String(ticketId).startsWith('AMR-')) {
      ticketId = await generateUniqueTicketId();
    }

    const reservation = await Reservation.create({
      ...data,
      ticketId,
      passengersCount: Number(data.passengersCount || 1),
      amount: Number(data.amount || 20),
      status: data.status || 'PENDING',
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
    });

    // Update user stats in MongoDB if userId provided
    if (data.userId) {
      try {
        await User.findOneAndUpdate(
          { uid: data.userId },
          { 
            $inc: { totalBookings: 1, totalSpent: Number(data.amount || 0) },
            $set: { lastLogin: new Date() }
          },
          { upsert: true }
        );
      } catch (uErr) {
        console.warn("User stats update non-fatal error:", uErr);
      }
    }

    res.status(201).json(reservation);
  } catch (error: any) {
    console.error("Error creating reservation in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de la réservation." });
  }
});

router.put('/reservations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };

    let reservation = await Reservation.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (!reservation) {
      reservation = await Reservation.findOneAndUpdate(
        { $or: [{ ticketId: id }, { firestoreId: id }] },
        { $set: updateData },
        { new: true }
      );
    }

    if (!reservation) {
      return res.status(404).json({ error: "Réservation introuvable." });
    }

    res.json(reservation);
  } catch (error: any) {
    console.error("Error updating reservation in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la modification de la réservation." });
  }
});

router.delete('/reservations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Reservation.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Réservation introuvable." });
    }
    res.json({ success: true, message: "Réservation supprimée avec succès." });
  } catch (error: any) {
    console.error("Error deleting reservation from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de la réservation." });
  }
});

// Boarding Gate Scan Verification Route
router.post('/reservations/scan-verify', async (req: Request, res: Response) => {
  try {
    const { rawCode, action } = req.body;
    if (!rawCode || !String(rawCode).trim()) {
      return res.status(400).json({ error: "Code scanné manquant." });
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
        status: 'error_not_found',
        message: `Billet introuvable avec la référence : ${cleanCode}`
      });
    }

    if (reservation.status !== 'VALIDATED') {
      return res.json({
        valid: false,
        status: 'alert_unpaid',
        reservation,
        message: `Billet non validé (Statut actuel : ${reservation.status}). Paiement requis avant embarquement.`
      });
    }

    if (reservation.isUsed) {
      return res.json({
        valid: false,
        status: 'alert_reused',
        reservation,
        message: `Attention : ce billet (${reservation.ticketId}) a déjà été composté le ${reservation.usedAt?.toLocaleString('fr-FR')}.`
      });
    }

    if (action === 'compost') {
      reservation.isUsed = true;
      reservation.usedAt = new Date();
      await reservation.save();
    }

    res.json({
      valid: true,
      status: 'success',
      reservation,
      message: `Billet vérifié avec succès pour ${reservation.fullName} (${reservation.travelClass} - ${reservation.ship}).`
    });
  } catch (error: any) {
    console.error("Scan verification error in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la validation du billet." });
  }
});

// -------------------------------------------------------------
// 6. NEWS & MEDIA (JOURNAL DE BORD)
// -------------------------------------------------------------
router.get('/news', async (req: Request, res: Response) => {
  try {
    const newsList = await News.find().sort({ publishedAt: -1 }).limit(100);
    res.json(newsList);
  } catch (error: any) {
    console.error("Error fetching news from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors du chargement des actualités." });
  }
});

router.get('/news/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await News.findById(id);
    if (!item) {
      return res.status(404).json({ error: "Article introuvable." });
    }
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors du chargement de l'article." });
  }
});

router.post('/news', async (req: Request, res: Response) => {
  try {
    const { title, content, imageUrl, videoUrl, media, author } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Le titre et le contenu sont obligatoires." });
    }
    const newsItem = await News.create({
      title,
      content,
      imageUrl: imageUrl || '',
      videoUrl: videoUrl || '',
      media: media || [],
      author: author || 'Direction AMR Mugote',
      views: 0,
      publishedAt: new Date()
    });
    res.status(201).json(newsItem);
  } catch (error: any) {
    console.error("Error creating news in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la publication de l'article." });
  }
});

router.put('/news/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const newsItem = await News.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!newsItem) {
      return res.status(404).json({ error: "Article introuvable." });
    }
    res.json(newsItem);
  } catch (error: any) {
    console.error("Error updating news in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'article." });
  }
});

router.delete('/news/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await News.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Article introuvable." });
    }
    // Delete associated comments
    await Comment.deleteMany({ newsId: id });
    res.json({ success: true, message: "Article supprimé avec succès." });
  } catch (error: any) {
    console.error("Error deleting news from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la suppression de l'article." });
  }
});

router.post('/news/:id/views', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await News.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true });
    res.json({ views: updated?.views || 0 });
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors de l'incrémentation des vues." });
  }
});

// Comments on news
router.get('/news/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comments = await Comment.find({ newsId: id }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors du chargement des commentaires." });
  }
});

router.post('/news/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, userName, userAvatar, text } = req.body;
    if (!text || !userName) {
      return res.status(400).json({ error: "Le nom et le texte du commentaire sont obligatoires." });
    }
    const comment = await Comment.create({
      newsId: id,
      userId: userId || '',
      userName,
      userAvatar: userAvatar || '',
      text,
      createdAt: new Date()
    });
    res.status(201).json(comment);
  } catch (error: any) {
    console.error("Error adding comment in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de l'ajout du commentaire." });
  }
});

// -------------------------------------------------------------
// 7. USERS & PASSENGER DIRECTORY
// -------------------------------------------------------------
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await User.find().sort({ lastLogin: -1 });
    res.json(users);
  } catch (error: any) {
    console.error("Error fetching users from MongoDB:", error);
    res.status(500).json({ error: "Erreur lors du chargement des utilisateurs." });
  }
});

router.post('/users/sync', async (req: Request, res: Response) => {
  try {
    const { uid, email, displayName, phone, photoURL, role, isVerified } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "UID utilisateur manquant." });
    }

    const user = await User.findOneAndUpdate(
      { uid },
      {
        $set: {
          email: email || '',
          displayName: displayName || '',
          phone: phone || '',
          photoURL: photoURL || '',
          isVerified: !!isVerified,
          lastLogin: new Date(),
          ...(role ? { role } : {})
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(user);
  } catch (error: any) {
    console.error("Error syncing user in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la synchronisation du compte." });
  }
});

router.put('/users/:uid', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error("Error updating user in MongoDB:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur." });
  }
});

// -------------------------------------------------------------
// 8. CONVERSATIONS & SUPPORT CHAT
// -------------------------------------------------------------
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const filter: any = userId ? { userId: String(userId) } : {};
    const conversations = await Conversation.find(filter).sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors du chargement des conversations." });
  }
});

router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const { userId, userName, userEmail, lastMessage } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId est requis." });
    }

    let conv = await Conversation.findOne({ userId, status: 'OPEN' });
    if (!conv) {
      conv = await Conversation.create({
        userId,
        userName: userName || 'Passager',
        userEmail: userEmail || '',
        lastMessage: lastMessage || 'Nouvelle conversation',
        status: 'OPEN',
        adminUnreadCount: 1
      });
    } else {
      conv.lastMessage = lastMessage || conv.lastMessage;
      conv.updatedAt = new Date();
      conv.adminUnreadCount += 1;
      await conv.save();
    }

    res.json(conv);
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors de la création de la conversation." });
  }
});

router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const messages = await Message.find({ conversationId: id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors de la récupération des messages." });
  }
});

router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, senderId, senderRole } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Le texte du message est obligatoire." });
    }

    const message = await Message.create({
      conversationId: id,
      text,
      senderId: senderId || '',
      senderRole: senderRole || 'USER',
      createdAt: new Date()
    });

    await Conversation.findByIdAndUpdate(id, {
      $set: {
        lastMessage: text,
        updatedAt: new Date()
      },
      $inc: { adminUnreadCount: senderRole === 'USER' ? 1 : 0 }
    });

    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: "Erreur lors de l'enregistrement du message." });
  }
});

// -------------------------------------------------------------
// 9. ONE-CLICK NON-DESTRUCTIVE MIGRATION: FIRESTORE -> MONGODB
// -------------------------------------------------------------
router.post('/migrate/firestore-to-mongodb', async (req: Request, res: Response) => {
  try {
    const adminApp = admin.apps.length ? admin.apps[0] : admin.initializeApp({ projectId: "mugote2" });
    const dbAdmin = getFirestore(adminApp, "ai-studio-020b031e-1447-4f1b-8ef0-ab4a23c0b6ab");
    const stats: Record<string, { migrated: number; errors: number }> = {
      settings: { migrated: 0, errors: 0 },
      schedules: { migrated: 0, errors: 0 },
      fleet: { migrated: 0, errors: 0 },
      news: { migrated: 0, errors: 0 },
      users: { migrated: 0, errors: 0 },
      reservations: { migrated: 0, errors: 0 }
    };

    console.log("🚀 Starting non-destructive migration from Firestore to MongoDB Atlas...");

    // 1. Migrate Site Settings
    try {
      const settingsSnap = await dbAdmin.collection('settings').doc('site').get();
      if (settingsSnap.exists) {
        const data = settingsSnap.data() || {};
        await SiteSettings.findOneAndUpdate(
          { key: 'site' },
          {
            $set: {
              homeBg: data.homeBg || '',
              homeDetail: data.homeDetail || '',
              adminCode: data.adminCode || 'MUGOTE2025',
              contactPhone: data.contactPhone || '+243 994 286 469',
              classPrices: data.classPrices || { VIP: 27, '1ère Classe': 27, '2ème Classe': 17, '3ème Classe': 10 },
              updatedAt: new Date()
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

    // 2. Migrate Schedules
    try {
      const schedSnap = await dbAdmin.collection('schedules').get();
      for (const doc of schedSnap.docs) {
        const d = doc.data();
        await Schedule.findOneAndUpdate(
          { firestoreId: doc.id },
          {
            $set: {
              firestoreId: doc.id,
              from: d.from || 'Bukavu',
              to: d.to || 'Goma',
              time: d.time || '07h30',
              ship: d.ship || 'Mugote 1',
              days: d.days || 'Tous les jours',
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

    // 3. Migrate Fleet
    try {
      const fleetSnap = await dbAdmin.collection('fleet').get();
      for (const doc of fleetSnap.docs) {
        const d = doc.data();
        await Boat.findOneAndUpdate(
          { firestoreId: doc.id },
          {
            $set: {
              firestoreId: doc.id,
              name: d.name || 'Mugote',
              capacity: Number(d.capacity || 120),
              description: d.description || '',
              imageUrl: d.imageUrl || '',
              gallery: d.gallery || [],
              status: d.status || 'ACTIF'
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

    // 4. Migrate News & Articles
    try {
      const newsSnap = await dbAdmin.collection('news').get();
      for (const doc of newsSnap.docs) {
        const d = doc.data();
        await News.findOneAndUpdate(
          { firestoreId: doc.id },
          {
            $set: {
              firestoreId: doc.id,
              title: d.title || 'Actualité AMR Mugote',
              content: d.content || '',
              imageUrl: d.imageUrl || '',
              videoUrl: d.videoUrl || '',
              media: d.media || [],
              author: d.author || 'Direction AMR Mugote',
              views: Number(d.views || 0),
              publishedAt: d.publishedAt?.toDate ? d.publishedAt.toDate() : new Date()
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

    // 5. Migrate Users
    try {
      const usersSnap = await dbAdmin.collection('users').get();
      for (const doc of usersSnap.docs) {
        const d = doc.data();
        await User.findOneAndUpdate(
          { uid: d.uid || doc.id },
          {
            $set: {
              firestoreId: doc.id,
              uid: d.uid || doc.id,
              email: d.email || '',
              displayName: d.displayName || d.name || '',
              phone: d.phone || '',
              role: d.role || 'CLIENT',
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

    // 6. Migrate Reservations
    try {
      const resSnap = await dbAdmin.collection('reservations').get();
      for (const doc of resSnap.docs) {
        const d = doc.data();
        await Reservation.findOneAndUpdate(
          { firestoreId: doc.id },
          {
            $set: {
              firestoreId: doc.id,
              ticketId: d.ticketId || `AMR-${doc.id.substring(0, 6).toUpperCase()}`,
              fullName: d.fullName || 'Passager',
              lastName: d.lastName || '',
              phone: d.phone || '',
              email: d.email || '',
              itinerary: d.itinerary || 'Bukavu-Goma',
              ship: d.ship || 'Mugote 1',
              travelDate: d.travelDate || new Date().toISOString().split('T')[0],
              departureTime: d.departureTime || '07h30',
              travelClass: d.travelClass || '2ème Classe',
              passengersCount: Number(d.passengersCount || 1),
              status: d.status || 'PENDING',
              paymentMethod: d.paymentMethod || 'Mobile Money',
              transactionId: d.transactionId || '',
              amount: Number(d.amount || 20),
              userId: d.userId || '',
              isUsed: !!d.isUsed,
              validatedAt: d.validatedAt ? (d.validatedAt.toDate ? d.validatedAt.toDate() : new Date(d.validatedAt)) : undefined,
              createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt)) : new Date()
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
      message: "Migration de Firestore vers MongoDB Atlas effectuée avec succès sans suppression de données.",
      stats
    });
  } catch (error: any) {
    console.error("Migration fatal error:", error);
    res.status(500).json({ error: "Erreur lors de la migration des données.", details: error?.message });
  }
});

function parseToDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  if (typeof val === 'object') {
    if ('seconds' in val && typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000);
    }
    if ('_seconds' in val && typeof val._seconds === 'number') {
      return new Date(val._seconds * 1000);
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

// Batch migration endpoint: accepts arrays of documents read by the frontend client (which has authenticated access to Firestore)
router.post('/migrate/batch', async (req: Request, res: Response) => {
  try {
    const { settings, schedules, fleet, news, users, reservations } = req.body || {};
    const stats: Record<string, { migrated: number; errors: number }> = {
      settings: { migrated: 0, errors: 0 },
      schedules: { migrated: 0, errors: 0 },
      fleet: { migrated: 0, errors: 0 },
      news: { migrated: 0, errors: 0 },
      users: { migrated: 0, errors: 0 },
      reservations: { migrated: 0, errors: 0 }
    };

    // 1. Settings
    if (settings) {
      try {
        await SiteSettings.findOneAndUpdate(
          { key: 'site' },
          {
            $set: {
              homeBg: settings.homeBg || '',
              homeDetail: settings.homeDetail || '',
              adminCode: settings.adminCode || 'MUGOTE2025',
              contactPhone: settings.contactPhone || '+243 994 286 469',
              classPrices: settings.classPrices || { VIP: 27, '1ère Classe': 27, '2ème Classe': 17, '3ème Classe': 10 },
              updatedAt: new Date()
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

    // 2. Schedules
    if (Array.isArray(schedules)) {
      for (const item of schedules) {
        try {
          const depTime = item.departureTime || item.time || '07h30';
          const itin = item.itinerary || (item.from && item.to ? `${item.from}-${item.to}` : 'Bukavu-Goma');
          const shipName = item.ship || 'Mugote 1';

          const query: any = item.id ? { firestoreId: item.id } : { departureTime: depTime, itinerary: itin, ship: shipName };

          await Schedule.findOneAndUpdate(
            query,
            {
              $set: {
                firestoreId: item.id || undefined,
                ship: shipName,
                departureTime: depTime,
                time: depTime,
                itinerary: itin,
                from: item.from || itin.split('-')[0] || 'Bukavu',
                to: item.to || itin.split('-')[1] || 'Goma',
                frequency: item.frequency || 'Quotidien',
                days: item.days || ['Tous les jours'],
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

    // 3. Fleet
    if (Array.isArray(fleet)) {
      for (const item of fleet) {
        try {
          await Boat.findOneAndUpdate(
            { $or: [{ firestoreId: item.id }, { name: item.name }] },
            {
              $set: {
                firestoreId: item.id,
                name: item.name || 'Mugote',
                capacity: Number(item.capacity || 120),
                description: item.description || '',
                imageUrl: item.imageUrl || '',
                gallery: item.gallery || [],
                status: item.status || 'ACTIF'
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

    // 4. News
    if (Array.isArray(news)) {
      for (const item of news) {
        try {
          await News.findOneAndUpdate(
            { firestoreId: item.id },
            {
              $set: {
                firestoreId: item.id,
                title: item.title || 'Actualité AMR Mugote',
                content: item.content || '',
                imageUrl: item.imageUrl || '',
                videoUrl: item.videoUrl || '',
                media: item.media || [],
                author: item.author || 'Direction AMR Mugote',
                views: Number(item.views || 0),
                publishedAt: parseToDate(item.publishedAt) || new Date()
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

    // 5. Users
    if (Array.isArray(users)) {
      for (const item of users) {
        try {
          await User.findOneAndUpdate(
            { uid: item.uid || item.id },
            {
              $set: {
                firestoreId: item.id,
                uid: item.uid || item.id,
                email: item.email || '',
                displayName: item.displayName || item.name || '',
                phone: item.phone || '',
                role: item.role || 'CLIENT',
                isVerified: !!item.isVerified
              }
            },
            { upsert: true }
          );
          stats.users.migrated++;
        } catch (e) {
          stats.users.errors++;
        }
      }
    }

    // 6. Reservations
    if (Array.isArray(reservations)) {
      for (const item of reservations) {
        try {
          await Reservation.findOneAndUpdate(
            { $or: [{ firestoreId: item.id }, { ticketId: item.ticketId }] },
            {
              $set: {
                firestoreId: item.id,
                ticketId: item.ticketId || `AMR-${(item.id || '').substring(0, 6).toUpperCase()}`,
                fullName: item.fullName || 'Passager',
                lastName: item.lastName || '',
                phone: item.phone || '',
                email: item.email || '',
                itinerary: item.itinerary || 'Bukavu-Goma',
                ship: item.ship || 'Mugote 1',
                travelDate: item.travelDate || new Date().toISOString().split('T')[0],
                departureTime: item.departureTime || '07h30',
                travelClass: item.travelClass || '2ème Classe',
                passengersCount: Number(item.passengersCount || 1),
                status: item.status || 'PENDING',
                paymentMethod: item.paymentMethod || 'Mobile Money',
                transactionId: item.transactionId || '',
                amount: Number(item.amount || 20),
                userId: item.userId || '',
                isUsed: !!item.isUsed,
                validatedAt: parseToDate(item.validatedAt),
                cancellationStatus: item.cancellationStatus || undefined,
                cancellationProcessedAt: parseToDate(item.cancellationProcessedAt),
                createdAt: parseToDate(item.createdAt) || new Date()
              }
            },
            { upsert: true }
          );
          stats.reservations.migrated++;
        } catch (e) {
          console.warn("Reservation migration item error:", e);
          stats.reservations.errors++;
        }
      }
    }

    res.json({
      success: true,
      message: "Synchronisation par lot effectuée avec succès dans MongoDB Atlas.",
      stats
    });
  } catch (error: any) {
    console.error("Batch migration fatal error:", error);
    res.status(500).json({ error: "Erreur lors de la synchronisation par lot.", details: error?.message });
  }
});

export default router;
