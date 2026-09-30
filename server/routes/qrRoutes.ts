import { Router, Request, Response } from 'express';
import { QrToken } from '../models/QrToken';
import { Reservation as MongoReservation } from '../models/Reservation';
import { QrSecurityService } from '../services/qrSecurityService';
import { sanitizeQrScanInput, qrVerifyRateLimiter } from '../middleware/qrSecurityMiddleware';
import { dbAdmin } from '../app';

const router = Router();

// =========================================================================
// 1. GÉNÉRATION SÉCURISÉE DE JETON & IMAGE QR CODE
// =========================================================================
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      ticketId,
      reservationId,
      passengerName,
      phone,
      itinerary,
      ship,
      travelDate,
      departureTime,
      travelClass,
      passengersCount,
      validityHours
    } = req.body;

    if (!ticketId || !passengerName) {
      return res.status(400).json({
        success: false,
        error: "Les champs 'ticketId' et 'passengerName' sont obligatoires."
      });
    }

    // 1. Génération cryptographique (UUID v4 + HMAC-SHA256)
    const hours = Number(validityHours) > 0 ? Number(validityHours) : 72;
    const tokenData = QrSecurityService.generateSecureToken(ticketId, hours);

    // 2. Génération de l'image DataURL Base64
    const qrDataUrl = await QrSecurityService.generateQrDataUrl(tokenData.token);

    // 3. Enregistrement / Révocation propre des anciens jetons pour ce billet
    await QrToken.updateMany(
      { ticketId: tokenData.ticketId, status: 'PENDING' },
      { $set: { status: 'REVOKED' } }
    );

    // 4. Création du nouveau jeton sécurisé dans MongoDB
    const qrDoc = await QrToken.create({
      token: tokenData.token,
      signature: tokenData.signature,
      nonce: tokenData.nonce,
      ticketId: tokenData.ticketId,
      reservationId: reservationId || undefined,
      passengerName: String(passengerName).trim(),
      phone: phone ? String(phone).trim() : '',
      itinerary: itinerary || 'GOMA - BUKAVU',
      ship: ship || 'Mugote 1',
      travelDate: travelDate || new Date().toISOString().split('T')[0],
      departureTime: departureTime || '07h30',
      travelClass: travelClass || 'Standard',
      passengersCount: Math.max(1, Number(passengersCount) || 1),
      status: 'PENDING',
      expiresAt: tokenData.expiresAt
    });

    return res.status(201).json({
      success: true,
      data: {
        token: qrDoc.token,
        qrDataUrl,
        ticketId: qrDoc.ticketId,
        passengerName: qrDoc.passengerName,
        status: qrDoc.status,
        expiresAt: qrDoc.expiresAt
      }
    });
  } catch (err: any) {
    console.error('Erreur lors de la génération du QR Code:', err);
    return res.status(500).json({
      success: false,
      error: 'Échec de génération du QR Code sécurisé.'
    });
  }
});

// =========================================================================
// 2. VALIDATION ATOMIQUE DU SCAN (ANTI-DOUBLE SCAN & ANTI-NOSQL INJECTION)
// =========================================================================
router.post(
  '/verify',
  qrVerifyRateLimiter(60, 60), // Limite anti-force brute : 60 req/min
  sanitizeQrScanInput,        // Protection stricte anti-injection NoSQL
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { token, scannerId, deviceFingerprint } = req.body;
    const clientIp = (
      req.headers['x-forwarded-for'] as string || 
      req.socket.remoteAddress || 
      '127.0.0.1'
    ).split(',')[0].trim();

    try {
      // Étape 1 : Vérification cryptographique en mémoire O(1) sans solliciter la base
      const struct = QrSecurityService.verifyTokenStructure(token);
      if (!struct.isValid) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SIGNATURE',
          error: struct.error || 'Signature du jeton non valide.'
        });
      }

      // Étape 2 : Opération Atomique findOneAndUpdate
      // Garantit l'absence totale de race conditions (Replay Attack / Double Scan simultané)
      // Seule la première requête où status === 'PENDING' et non-expirée réussira.
      const now = new Date();
      const updatedQr = await QrToken.findOneAndUpdate(
        {
          token: token,
          status: 'PENDING',
          expiresAt: { $gt: now }
        },
        {
          $set: {
            status: 'USED',
            usedAt: now,
            usedByScannerId: scannerId,
            ipAddress: clientIp,
            deviceFingerprint: deviceFingerprint || null
          }
        },
        {
          new: true, // Renvoie l'enregistrement mis à jour
          runValidators: true
        }
      );

      // CAS SUCCÈS : Le passager est autorisé à embarquer
      if (updatedQr) {
        const responseTimeMs = Date.now() - startTime;

        // Synchronisation asynchrone non-bloquante avec la collection Réservation & Firestore
        (async () => {
          try {
            await MongoReservation.updateOne(
              { ticketId: updatedQr.ticketId },
              {
                $set: {
                  boardingStatus: 'BOARDED',
                  boarded: true,
                  boardedAt: now.getTime(),
                  isUsed: true,
                  usedAt: now
                }
              }
            );

            if (dbAdmin) {
              const qSnap = await dbAdmin
                .collection('reservations')
                .where('ticketId', '==', updatedQr.ticketId)
                .limit(1)
                .get();

              if (!qSnap.empty) {
                await qSnap.docs[0].ref.update({
                  boardingStatus: 'BOARDED',
                  boarded: true,
                  boardedAt: now.getTime(),
                  isUsed: true,
                  usedAt: now
                });
              }
            }
          } catch (syncErr) {
            console.warn('Notification sync réserves après scan:', syncErr);
          }
        })();

        return res.status(200).json({
          success: true,
          code: 'BOARDING_ALLOWED',
          message: 'Embarquement validé avec succès ! Billet consommé.',
          responseTimeMs,
          ticket: {
            ticketId: updatedQr.ticketId,
            passengerName: updatedQr.passengerName,
            itinerary: updatedQr.itinerary,
            ship: updatedQr.ship,
            travelDate: updatedQr.travelDate,
            departureTime: updatedQr.departureTime,
            travelClass: updatedQr.travelClass,
            passengersCount: updatedQr.passengersCount,
            status: updatedQr.status,
            usedAt: updatedQr.usedAt,
            scannerId: updatedQr.usedByScannerId
          }
        });
      }

      // CAS ÉCHEC : Analyse précise de la cause pour l'agent portuaire
      const existingToken = await QrToken.findOne({ token }).lean();

      if (!existingToken) {
        return res.status(404).json({
          success: false,
          code: 'TOKEN_NOT_FOUND',
          error: "QR Code non reconnu dans la base de données. Billet introuvable ou faux."
        });
      }

      // Si le statut est déjà USED : Alerte Double Validation (Anti-fraude)
      if (existingToken.status === 'USED') {
        const formattedDate = existingToken.usedAt 
          ? new Date(existingToken.usedAt).toLocaleString('fr-FR')
          : 'date inconnue';

        return res.status(409).json({
          success: false,
          code: 'ALREADY_USED',
          error: `ALERTE FRAUDE : Ce billet a DÉJÀ ÉTÉ SCANNÉ et VALIDÉ le ${formattedDate} par le terminal [${existingToken.usedByScannerId || 'N/A'}]. Accès refusé !`,
          usedAt: existingToken.usedAt,
          scannerId: existingToken.usedByScannerId,
          ticketId: existingToken.ticketId,
          passengerName: existingToken.passengerName
        });
      }

      // Si le jeton est expiré
      if (existingToken.status === 'EXPIRED' || (existingToken.expiresAt && new Date(existingToken.expiresAt) <= now)) {
        return res.status(410).json({
          success: false,
          code: 'EXPIRED',
          error: "Ce QR code a expiré. La date de validité maximale pour cette traversée est dépassée.",
          expiresAt: existingToken.expiresAt
        });
      }

      // Si révoqué
      if (existingToken.status === 'REVOKED') {
        return res.status(403).json({
          success: false,
          code: 'REVOKED',
          error: "Ce QR code a été révoqué ou remplacé par un nouveau titre de transport."
        });
      }

      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        error: "Impossible de valider ce jeton pour le moment."
      });

    } catch (err: any) {
      console.error('Erreur critique lors de la vérification QR:', err);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        error: 'Erreur interne du serveur lors de la validation du scan.'
      });
    }
  }
);

// =========================================================================
// 3. CONSULTATION RAPIDE D'ÉTAT SANS CONSOMMATION
// =========================================================================
router.get('/status/:token', async (req: Request, res: Response) => {
  try {
    const rawToken = String(req.params.token || '').trim();
    if (!rawToken || /[\${}[\]]/.test(rawToken)) {
      return res.status(400).json({ success: false, error: 'Jeton invalide.' });
    }

    const tokenDoc = await QrToken.findOne({ token: rawToken }).lean();
    if (!tokenDoc) {
      return res.status(404).json({ success: false, error: 'Jeton QR introuvable.' });
    }

    return res.json({
      success: true,
      ticketId: tokenDoc.ticketId,
      passengerName: tokenDoc.passengerName,
      status: tokenDoc.status,
      usedAt: tokenDoc.usedAt,
      expiresAt: tokenDoc.expiresAt
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erreur de consultation.' });
  }
});

export default router;
