import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';
import { SiteSettings } from '../models/SiteSettings';
import { connectMongoDB } from '../db';

export interface EmailSendResult {
  success: boolean;
  simulated?: boolean;
  messageId?: string;
  recipient: string;
  subject: string;
  error?: string;
  details?: string;
}

export interface EmailStatusResponse {
  configured: boolean;
  source: 'env' | 'database' | 'none';
  provider: string;
  fromAddress: string;
  host: string;
  port: number;
  user: string;
}

export interface SmtpConfigOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;
  private configSource: 'env' | 'database' | 'none' = 'none';
  private currentConfig: SmtpConfigOptions = {};

  constructor() {
    this.initFromEnv();
    // Charge également la configuration depuis MongoDB en arrière-plan si env est vide
    this.loadDbConfigIfAvailable().catch(err => {
      console.warn("[EmailService] Note: initialisation DB config différée:", err?.message || err);
    });
  }

  /**
   * Initialise le transporteur depuis les variables d'environnement
   */
  public initFromEnv() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
    
    // Support multi-alias pour les variables d'environnement (SMTP_USER, GMAIL_USER, EMAIL_USER...)
    const user = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || '').trim();
    
    // Mot de passe d'application Google ou mot de passe SMTP (avec suppression des espaces éventuels)
    const rawPass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || '').trim();
    const pass = rawPass.replace(/\s+/g, '');

    const from = process.env.EMAIL_FROM || (user ? `AMR MUGOTE ET SES FRÈRES <${user}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    if (user && pass) {
      this.currentConfig = { host, port, secure, user, pass, from };
      this.setupTransporter(this.currentConfig, 'env');
    } else {
      this.transporter = null;
      this.isConfigured = false;
      this.configSource = 'none';
      console.log("ℹ️ [EmailService] Aucun identifiant SMTP configuré dans process.env. Recherche en cours...");
    }
  }

  /**
   * Charge la configuration SMTP stockée dans la base MongoDB Atlas si absente de process.env
   */
  public async loadDbConfigIfAvailable(): Promise<boolean> {
    if (this.isConfigured && this.configSource === 'env') {
      return true;
    }

    try {
      await connectMongoDB();
      const settings = await SiteSettings.findOne({ key: 'site' }).lean();
      if (settings && settings.smtpUser && settings.smtpPass) {
        const host = settings.smtpHost || 'smtp.gmail.com';
        const port = Number(settings.smtpPort || (host === 'smtp.gmail.com' ? 465 : 587));
        const secure = typeof settings.smtpSecure === 'boolean' ? settings.smtpSecure : port === 465;
        const user = String(settings.smtpUser).trim();
        const pass = String(settings.smtpPass).trim().replace(/\s+/g, '');
        const from = settings.emailFrom || `AMR MUGOTE ET SES FRÈRES <${user}>`;

        if (user && pass) {
          this.currentConfig = { host, port, secure, user, pass, from };
          this.setupTransporter(this.currentConfig, 'database');
          console.log(`✅ [EmailService] SMTP configuré depuis MongoDB pour ${user}`);
          return true;
        }
      }
    } catch (err: any) {
      console.warn("⚠️ [EmailService] Impossible de charger les identifiants SMTP depuis MongoDB:", err?.message || err);
    }
    return false;
  }

  /**
   * Configure et instancie le transporteur Nodemailer avec options de résilience
   */
  public setupTransporter(config: SmtpConfigOptions, source: 'env' | 'database' = 'env'): boolean {
    const host = config.host || 'smtp.gmail.com';
    const port = Number(config.port || (host === 'smtp.gmail.com' ? 465 : 587));
    const secure = typeof config.secure === 'boolean' ? config.secure : port === 465;
    const user = (config.user || '').trim();
    const pass = (config.pass || '').trim().replace(/\s+/g, '');

    if (!user || !pass) {
      this.transporter = null;
      this.isConfigured = false;
      this.configSource = 'none';
      return false;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 15000, // 15s max pour éviter le blocage de requête
        greetingTimeout: 15000,
        socketTimeout: 20000,
        tls: {
          rejectUnauthorized: false
        }
      });

      this.isConfigured = true;
      this.configSource = source;
      this.currentConfig = { host, port, secure, user, pass, from: config.from };
      console.log(`✅ [EmailService] Transporteur SMTP initialisé (${source}) : ${user} via ${host}:${port} (secure=${secure})`);
      return true;
    } catch (err: any) {
      console.error("❌ [EmailService] Échec création du transporteur SMTP:", err);
      this.transporter = null;
      this.isConfigured = false;
      this.configSource = 'none';
      return false;
    }
  }

  /**
   * Vérifie la connexion SMTP en direct avec le serveur distant (handshake d'authentification)
   */
  public async verifyConnection(): Promise<{ ok: boolean; message: string; code?: string }> {
    if (!this.isConfigured || !this.transporter) {
      // Tentative de recharger depuis la base de données
      const loaded = await this.loadDbConfigIfAvailable();
      if (!loaded || !this.transporter) {
        return {
          ok: false,
          message: "Service SMTP non configuré. Renseignez votre adresse Gmail et votre Mot de passe d'application."
        };
      }
    }

    try {
      await this.transporter.verify();
      return {
        ok: true,
        message: `Connexion SMTP réussie avec ${this.currentConfig.host}:${this.currentConfig.port} pour ${this.currentConfig.user}`
      };
    } catch (err: any) {
      console.error("❌ [EmailService] Échec du test de vérification SMTP:", err);
      
      // Analyse contextuelle de l'erreur
      let explanation = err.message || String(err);
      if (err.code === 'EAUTH' || explanation.includes('Username and Password not accepted') || explanation.includes('BadCredentials')) {
        explanation = "Identifiants refusés par Google. Pour Gmail, vous devez générer un 'Mot de passe d'application' (16 lettres) sur https://myaccount.google.com/apppasswords et non votre mot de passe de compte personnel.";
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        explanation = `Délai d'attente dépassé ou connexion refusée sur le port ${this.currentConfig.port}. Le port 587 (STARTTLS) sera automatiquement essayé en repli.`;
      }

      return {
        ok: false,
        message: explanation,
        code: err.code
      };
    }
  }

  /**
   * Envoie un mail avec mécanisme de repli automatique (465 SSL <-> 587 TLS)
   */
  private async executeSendMail(mailOptions: SendMailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured || !this.transporter) {
      await this.loadDbConfigIfAvailable();
    }

    if (!this.isConfigured || !this.transporter) {
      return {
        success: false,
        error: "SMTP non configuré. Mode simulation."
      };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (primaryErr: any) {
      console.warn(`⚠️ [EmailService] Échec envoi primaire (${this.currentConfig.host}:${this.currentConfig.port}):`, primaryErr.message);

      // Si erreur réseau / port (ETIMEDOUT, ECONNREFUSED, ESOCKETTIMEDOUT), tenter le port alternatif
      const isNetworkIssue = primaryErr.code === 'ETIMEDOUT' || 
                             primaryErr.code === 'ECONNREFUSED' || 
                             primaryErr.code === 'ESOCKETTIMEDOUT' ||
                             String(primaryErr.message).includes('timeout');

      if (isNetworkIssue && this.currentConfig.user && this.currentConfig.pass) {
        const fallbackPort = this.currentConfig.port === 465 ? 587 : 465;
        const fallbackSecure = fallbackPort === 465;
        console.log(`🔄 [EmailService] Tentative de repli automatique sur le port ${fallbackPort} (secure=${fallbackSecure})...`);

        try {
          const fallbackTransporter = nodemailer.createTransport({
            host: this.currentConfig.host || 'smtp.gmail.com',
            port: fallbackPort,
            secure: fallbackSecure,
            auth: {
              user: this.currentConfig.user,
              pass: this.currentConfig.pass
            },
            connectionTimeout: 15000,
            socketTimeout: 20000,
            tls: { rejectUnauthorized: false }
          });

          const fallbackInfo = await fallbackTransporter.sendMail(mailOptions);
          console.log(`✅ [EmailService] Envoi réussi via le port de repli ${fallbackPort} ! (Message ID: ${fallbackInfo.messageId})`);

          // Conserver ce port réussi pour les prochains envois
          this.transporter = fallbackTransporter;
          this.currentConfig.port = fallbackPort;
          this.currentConfig.secure = fallbackSecure;

          return { success: true, messageId: fallbackInfo.messageId };
        } catch (fallbackErr: any) {
          console.error(`❌ [EmailService] Échec également sur le port de repli ${fallbackPort}:`, fallbackErr.message);
          return {
            success: false,
            error: `Échec envoi SMTP (${primaryErr.message} / Repli: ${fallbackErr.message})`
          };
        }
      }

      return {
        success: false,
        error: primaryErr.message || String(primaryErr)
      };
    }
  }

  public getStatus(): EmailStatusResponse {
    const user = this.currentConfig.user || process.env.SMTP_USER || '';
    const maskedUser = user ? (user.includes('@') ? `${user.split('@')[0].slice(0, 3)}***@${user.split('@')[1]}` : `${user.slice(0, 3)}***`) : 'Non configuré';
    
    return {
      configured: this.isConfigured,
      source: this.configSource,
      provider: this.currentConfig.host ? (this.currentConfig.host.includes('gmail') ? 'Gmail SMTP' : this.currentConfig.host) : 'Gmail SMTP (smtp.gmail.com)',
      fromAddress: this.currentConfig.from || process.env.EMAIL_FROM || (user ? `AMR MUGOTE <${user}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>'),
      host: this.currentConfig.host || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(this.currentConfig.port || process.env.SMTP_PORT || 465),
      user: maskedUser
    };
  }

  // =========================================================================
  // 1. CONFIRMATION DE RÉSERVATION OFFICIELLE & BILLET ÉLECTRONIQUE (PRIORITAIRE)
  // =========================================================================
  public async sendBookingConfirmation(reservation: {
    fullName: string;
    lastName?: string;
    email: string;
    phone?: string;
    ticketId?: string;
    itinerary: string;
    ship: string;
    travelDate: string;
    departureTime?: string;
    travelClass?: string;
    passengersCount?: number;
    amount?: number | string;
    status?: string;
    boardingStatus?: string;
    boarded?: boolean;
    transactionId?: string;
  }): Promise<EmailSendResult> {
    if (!reservation.email || !reservation.email.includes('@')) {
      return {
        success: false,
        recipient: reservation.email || 'N/A',
        subject: 'Confirmation de Réservation & Billet',
        error: "Adresse email invalide ou manquante."
      };
    }

    const recipient = reservation.email.trim();
    const passengerName = `${reservation.fullName} ${reservation.lastName || ''}`.trim() || 'Cher Passager';
    const departureTime = reservation.departureTime || '07h30';
    const travelDate = reservation.travelDate || 'Date du jour';
    const ticketId = reservation.ticketId || `AMR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const ship = reservation.ship || 'Mugote 1';
    const itinerary = reservation.itinerary || 'Bukavu ➔ Goma';
    const travelClass = reservation.travelClass || '2ème Classe';
    const passengersCount = Number(reservation.passengersCount || 1);
    const amount = reservation.amount ? `${reservation.amount}.00 $` : '20.00 $';

    const isBoarded = reservation.boardingStatus === 'BOARDED' || reservation.boarded === true;
    const isValidated = reservation.status === 'VALIDATED';

    let statusText = 'CONFIRMÉ & ACTIF';
    let subject = `⚓ Billet Officiel & Confirmation : ${itinerary} - N° ${ticketId} [AMR MUGOTE]`;
    let mainHeading = "Confirmation de Billet & Enregistrement";
    let statusBadgeColor = "#065f46";
    let statusBgColor = "#ecfdf5";
    let statusBorderColor = "#10b981";
    let actionNotice = `Nous confirmons avec plaisir l'enregistrement de votre réservation sur nos lignes régulières du Lac Kivu. Votre billet électronique a été généré avec succès.`;

    if (isBoarded) {
      statusText = '🚢 PASSAGER LÂCHÉ & EMBARQUÉ À BORD • VALIDÉ';
      subject = `🚢 Passager Lâché & Embarqué à Bord - Billet ${ticketId} (${itinerary}) [AMR MUGOTE]`;
      mainHeading = "Passager Lâché & Embarquement Validé";
      statusBadgeColor = "#065f46";
      statusBgColor = "#d1fae5";
      statusBorderColor = "#059669";
      actionNotice = `L'administrateur a <strong>officiellement lâché votre passager et autorisé son embarquement à bord</strong> du navire <strong>${ship}</strong>. Votre titre de transport est validé et en règle dans notre registre portuaire.`;
    } else if (isValidated) {
      statusText = '⚓ BILLET OFFICIEL VALIDÉ PAR L\'ADMINISTRATION';
      subject = `⚓ Billet Officiel Validé par l'Administration - N° ${ticketId} (${itinerary}) [AMR MUGOTE]`;
      mainHeading = "Billet Officiel Validé par l'Administration";
      statusBadgeColor = "#065f46";
      statusBgColor = "#ecfdf5";
      statusBorderColor = "#10b981";
      actionNotice = `L'administrateur a <strong>validé votre billet officiel</strong> sur nos lignes régulières du Lac Kivu. Votre titre de transport est maintenant actif et prêt pour l'embarquement.`;
    }

    // Calcul de l'heure conseillée d'embarquement (45 min avant)
    let boardingAdvice = "Arrivée recommandée 45 minutes avant le départ";
    try {
      const parts = departureTime.replace('h', ':').split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10) - 45;
        if (m < 0) {
          m += 60;
          h = (h - 1 + 24) % 24;
        }
        const hStr = h < 10 ? `0${h}` : `${h}`;
        const mStr = m < 10 ? `0${m}` : `${m}`;
        boardingAdvice = `Présentez-vous au quai dès ${hStr}h${mStr} (au moins 45 minutes avant)`;
      }
    } catch {
      // ignore
    }

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b192c; margin: 0; padding: 24px 12px; color: #0f172a; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid #e2e8f0; }
    
    .header { background: linear-gradient(135deg, #001233 0%, #032b69 100%); padding: 36px 28px; text-align: center; color: #ffffff; border-bottom: 4px solid #d97706; }
    .gold-badge { display: inline-block; background: #d97706; color: #ffffff; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; padding: 5px 16px; border-radius: 9999px; margin-bottom: 12px; }
    .title { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
    .subtitle { margin: 8px 0 0 0; color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }

    .content { padding: 32px 28px; }
    .greeting { font-size: 15px; color: #1e293b; margin-bottom: 22px; line-height: 1.6; }
    
    .ticket-hero { background: #f8fafc; border: 2px solid #001233; border-radius: 16px; padding: 24px; margin-bottom: 24px; position: relative; }
    .ticket-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 14px; margin-bottom: 18px; }
    .ticket-id { font-size: 20px; font-weight: 900; color: #001233; font-family: monospace; letter-spacing: 1px; }
    .ticket-status { background: ${statusBgColor}; border: 1px solid ${statusBorderColor}; color: ${statusBadgeColor}; padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 900; text-transform: uppercase; }

    .route-banner { background: #001233; color: #ffffff; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 18px; }
    .route-title { font-size: 22px; font-weight: 900; color: #ffffff; margin-bottom: 4px; }
    .route-time { font-size: 14px; color: #fbbf24; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }

    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .detail-cell { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
    .detail-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 3px; }
    .detail-val { font-size: 13px; font-weight: 800; color: #0f172a; }

    .boarding-box { background: #fef3c7; border-left: 4px solid #d97706; padding: 16px 18px; border-radius: 0 10px 10px 0; margin-bottom: 24px; font-size: 13px; color: #78350f; line-height: 1.5; font-weight: 600; }

    .guidelines { background: #f1f5f9; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
    .guidelines h4 { margin: 0 0 12px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
    .guidelines ul { margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6; }

    .contacts { border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; text-align: center; }
    .contacts strong { color: #0f172a; }

    .footer { background: #000c22; color: #94a3b8; padding: 22px; text-align: center; font-size: 11px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="gold-badge">⚓ Titre de Transport Maritime Officiel</div>
      <h1 class="title">AMR MUGOTE ET SES FRÈRES</h1>
      <p class="subtitle">Compagnie de Navigation du Lac Kivu • Bukavu - Goma</p>
    </div>

    <div class="content">
      <p class="greeting">
        Bonjour <strong>${passengerName}</strong>,<br>
        ${actionNotice}
      </p>

      <div class="ticket-hero">
        <div class="ticket-header">
          <div>
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">Numéro de Billet</div>
            <div class="ticket-id">${ticketId}</div>
          </div>
          <div class="ticket-status">${statusText}</div>
        </div>

        <div class="route-banner">
          <div class="route-title">${itinerary}</div>
          <div class="route-time">Départ : ${travelDate} à ${departureTime}</div>
        </div>

        <div class="details-grid">
          <div class="detail-cell">
            <div class="detail-label">Navire Assigné</div>
            <div class="detail-val">${ship}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-label">Classe de Voyage</div>
            <div class="detail-val">${travelClass}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-label">Nombre de Place(s)</div>
            <div class="detail-val">${passengersCount} passager(s)</div>
          </div>
          <div class="detail-cell">
            <div class="detail-label">Montant Total Réglé</div>
            <div class="detail-val" style="color: #059669; font-family: monospace;">${amount}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-label">Passager Principal</div>
            <div class="detail-val">${passengerName}</div>
          </div>
          <div class="detail-cell">
            <div class="detail-label">Téléphone Déclaré</div>
            <div class="detail-val">${reservation.phone || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div class="boarding-box">
        ⚠️ <strong>Consigne d'Embarquement :</strong> ${boardingAdvice}. Les contrôleurs au port disposent de la synchronisation en temps réel de votre billet validé.
      </div>

      <div class="guidelines">
        <h4>📋 Formalités de Voyage sur le Lac Kivu</h4>
        <ul>
          <li><strong>Présentation du Billet :</strong> Vous pouvez présenter ce billet directement sur l'écran de votre téléphone (depuis l'onglet "Mes Billets" de l'application) ou au format papier imprimé.</li>
          <li><strong>Pièce d'Identité :</strong> Une pièce d'identité valide (Carte d'électeur, Passeport ou Permis) est requise pour tout embarquement.</li>
          <li><strong>Ports d'Accès :</strong> Port Ihusi à Bukavu / Port Public SNCC à Goma.</li>
          <li><strong>Bagages :</strong> Les bagages doivent être étiquetés avant le chargement dans les cales du navire.</li>
        </ul>
      </div>

      <div class="contacts">
        <strong>Assistance & Permanence Portuaire 24/7 :</strong><br>
        Port de Bukavu : <strong>+243 994 102 673</strong> &nbsp;|&nbsp; Port de Goma : <strong>+243 816 680 709</strong><br>
        Email Direction : <a href="mailto:birekeidea@gmail.com" style="color: #0284c7; text-decoration: none;">birekeidea@gmail.com</a>
      </div>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} AMR MUGOTE ET SES FRÈRES • Transport Lacustre Bukavu - Goma.<br>
      Ce message automatique certifie votre enregistrement sur les registres officiels de navigation.
    </div>
  </div>
</body>
</html>
    `;

    const from = this.currentConfig.from || process.env.EMAIL_FROM || (this.currentConfig.user ? `AMR MUGOTE <${this.currentConfig.user}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    // Exécution réelle si configuré
    if (this.isConfigured) {
      const sendRes = await this.executeSendMail({
        from,
        to: recipient,
        subject,
        html,
        text: `Bonjour ${passengerName},\n\nVotre réservation AMR MUGOTE ET SES FRÈRES est confirmée.\nN° Billet: ${ticketId}\nTrajet: ${itinerary}\nNavire: ${ship} (${travelClass})\nDépart: ${travelDate} à ${departureTime}\n${boardingAdvice}.\nMontant: ${amount}.\nContacts: +243 994 102 673 / +243 816 680 709.`
      });

      if (sendRes.success) {
        console.log(`✅ [EmailService] Confirmation de réservation envoyée à ${recipient} (Message ID: ${sendRes.messageId})`);
        return {
          success: true,
          recipient,
          subject,
          messageId: sendRes.messageId
        };
      } else {
        console.error(`❌ [EmailService] Échec de l'acheminement SMTP vers ${recipient}:`, sendRes.error);
        return {
          success: false,
          recipient,
          subject,
          error: sendRes.error
        };
      }
    }

    // Mode simulation (en attendant configuration des identifiants SMTP réels)
    console.log(`📫 [EmailService SIMULATION] Confirmation de réservation générée pour ${recipient}:`);
    console.log(`   - Billet: ${ticketId} (${passengerName})`);
    console.log(`   - Trajet: ${itinerary} à ${departureTime} le ${travelDate} sur ${ship}`);
    console.log(`   - Note: Configurez SMTP_USER et SMTP_PASS pour un envoi direct par Gmail.`);

    return {
      success: true,
      simulated: true,
      recipient,
      subject,
      messageId: `sim-confirm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
  }

  // =========================================================================
  // 2. RAPPEL D'HEURE DE DÉPART (H-45 MIN)
  // =========================================================================
  public async sendDepartureReminder(reservation: {
    fullName: string;
    lastName?: string;
    email: string;
    ticketId?: string;
    itinerary: string;
    ship: string;
    travelDate: string;
    departureTime?: string;
    travelClass?: string;
    passengersCount?: number;
  }): Promise<EmailSendResult> {
    if (!reservation.email || !reservation.email.includes('@')) {
      return {
        success: false,
        recipient: reservation.email || 'N/A',
        subject: 'Rappel de départ',
        error: "Adresse email invalide ou manquante."
      };
    }

    const recipient = reservation.email.trim();
    const passengerName = `${reservation.fullName} ${reservation.lastName || ''}`.trim() || 'Cher Passager';
    const departureTime = reservation.departureTime || '07h30';
    const travelDate = reservation.travelDate || 'Date du jour';
    const ticketId = reservation.ticketId || 'AMR-BILLET';
    const ship = reservation.ship || 'Mugote 1';
    const itinerary = reservation.itinerary || 'Bukavu ➔ Goma';
    const travelClass = reservation.travelClass || '2ème Classe';

    const subject = `⚓ Rappel de Départ : Voyage ${itinerary} à ${departureTime} - Billet N° ${ticketId}`;

    let boardingAdvice = "Arrivée recommandée 45 minutes avant le départ";
    try {
      const parts = departureTime.replace('h', ':').split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10) - 45;
        if (m < 0) {
          m += 60;
          h = (h - 1 + 24) % 24;
        }
        const hStr = h < 10 ? `0${h}` : `${h}`;
        const mStr = m < 10 ? `0${m}` : `${m}`;
        boardingAdvice = `Présentez-vous au quai dès ${hStr}h${mStr} (au moins 45 minutes avant)`;
      }
    } catch {
      // ignore
    }

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #001233 0%, #0A2540 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .gold-pill { display: inline-block; background: #d97706; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 14px; border-radius: 20px; margin-bottom: 12px; }
    .title { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .subtitle { margin: 8px 0 0 0; color: #cbd5e1; font-size: 13px; font-weight: 500; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 16px; color: #334155; margin-bottom: 20px; line-height: 1.6; }
    .departure-hero { text-align: center; background: #001233; color: #ffffff; border-radius: 12px; padding: 18px 12px; margin-bottom: 16px; }
    .departure-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #f59e0b; font-weight: 800; }
    .departure-time { font-size: 38px; font-weight: 900; letter-spacing: -1px; margin: 4px 0; color: #ffffff; }
    .departure-date { font-size: 14px; color: #94a3b8; font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .info-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .info-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .info-val { font-size: 14px; font-weight: 800; color: #0f172a; }
    .advice-box { background: #fef3c7; border-left: 4px solid #d97706; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 13px; color: #78350f; font-weight: 600; line-height: 1.5; }
    .footer { background: #000c22; color: #94a3b8; padding: 20px; text-align: center; font-size: 11px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="gold-pill">⚓ Rappel Officiel de Départ</div>
      <h1 class="title">AMR MUGOTE ET SES FRÈRES</h1>
      <p class="subtitle">Transport Maritime sur le Lac Kivu • Bukavu - Goma</p>
    </div>

    <div class="content">
      <p class="greeting">
        Bonjour <strong>${passengerName}</strong>,<br>
        La compagnie <strong>AMR MUGOTE ET SES FRÈRES</strong> vous rappelle l'heure de départ de votre voyage aujourd'hui.
      </p>

      <div class="departure-hero">
        <div class="departure-label">Heure Précise de Départ</div>
        <div class="departure-time">${departureTime}</div>
        <div class="departure-date">Date de Voyage : ${travelDate}</div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">N° de Billet</div>
          <div class="info-val">${ticketId}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Bateau Assigné</div>
          <div class="info-val">${ship}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Trajet Prévu</div>
          <div class="info-val">${itinerary}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Classe de Voyage</div>
          <div class="info-val">${travelClass}</div>
        </div>
      </div>

      <div class="advice-box">
        ⚠️ <strong>Consigne d'Embarquement :</strong> ${boardingAdvice}. Les portes d'accès aux quais ferment 15 minutes avant le départ.
      </div>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} AMR MUGOTE ET SES FRÈRES. Permanence : +243 994 102 673 / +243 816 680 709.
    </div>
  </div>
</body>
</html>
    `;

    const from = this.currentConfig.from || process.env.EMAIL_FROM || (this.currentConfig.user ? `AMR MUGOTE <${this.currentConfig.user}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    if (this.isConfigured) {
      const sendRes = await this.executeSendMail({
        from,
        to: recipient,
        subject,
        html,
        text: `Rappel de départ AMR MUGOTE: Billet ${ticketId}, Trajet ${itinerary} à ${departureTime} le ${travelDate}. ${boardingAdvice}.`
      });

      if (sendRes.success) {
        return { success: true, recipient, subject, messageId: sendRes.messageId };
      }
      return { success: false, recipient, subject, error: sendRes.error };
    }

    return {
      success: true,
      simulated: true,
      recipient,
      subject,
      messageId: `sim-reminder-${Date.now()}`
    };
  }

  // =========================================================================
  // 3. TEST DE CONNECTIVITÉ SMTP ENVOYÉ À L'ADMIN OU UTILISATEUR
  // =========================================================================
  public async sendTestEmail(targetEmail: string): Promise<EmailSendResult> {
    const subject = "⚓ Test de Connectivité Email - AMR MUGOTE ET SES FRÈRES";
    const from = this.currentConfig.from || process.env.EMAIL_FROM || (this.currentConfig.user ? `AMR MUGOTE <${this.currentConfig.user}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    const html = `
      <div style="font-family: sans-serif; padding: 24px; background: #f8fafc; border-radius: 16px; border: 1px solid #cbd5e1; max-width: 550px; margin: 0 auto;">
        <h2 style="color: #001233; margin-top: 0;">⚓ Test de Connexion Email Réussi !</h2>
        <p style="color: #334155; line-height: 1.6;">
          Ce message confirme que le service d'envoi d'emails et de confirmations de billets de <strong>AMR MUGOTE ET SES FRÈRES</strong> fonctionne correctement et délivre bien les emails dans votre boîte de réception.
        </p>
        <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; color: #065f46; font-size: 13px; font-weight: bold;">
          ✓ Connexion SMTP validée (${this.currentConfig.host}:${this.currentConfig.port})
        </div>
        <p style="color: #64748b; font-size: 12px;">
          Tous les voyageurs réservant un voyage sur le lac Kivu recevront désormais automatiquement leur billet officiel avec QR code à leur adresse email.
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;">
        <small style="color: #94a3b8;">Horodatage : ${new Date().toLocaleString('fr-FR')}</small>
      </div>
    `;

    if (this.isConfigured) {
      const sendRes = await this.executeSendMail({
        from,
        to: targetEmail,
        subject,
        html,
        text: "Test de connectivité email réussi pour AMR MUGOTE ET SES FRÈRES."
      });

      if (sendRes.success) {
        return { success: true, recipient: targetEmail, subject, messageId: sendRes.messageId };
      }
      return { success: false, recipient: targetEmail, subject, error: sendRes.error };
    }

    return {
      success: true,
      simulated: true,
      recipient: targetEmail,
      subject,
      messageId: `sim-test-${Date.now()}`
    };
  }

  // =========================================================================
  // 4. INSCRIPTION AGENDA TEMPS RÉEL
  // =========================================================================
  public async sendAgendaRegistrationConfirmation(agendaItem: {
    email: string;
    fullName: string;
    ticketId: string;
    ship: string;
    itinerary: string;
    travelDate: string;
    departureTime: string;
    boardingTime: string;
    travelClass?: string;
  }): Promise<EmailSendResult> {
    if (!agendaItem.email || !agendaItem.email.includes('@')) {
      return {
        success: false,
        recipient: agendaItem.email || 'N/A',
        subject: "Inscription Agenda Serveur",
        error: "Adresse email invalide."
      };
    }

    const recipient = agendaItem.email.trim();
    const subject = `⚓ Billet ${agendaItem.ticketId} - Inscrit à l'Agenda & Alertes Bateau [AMR MUGOTE]`;
    const from = this.currentConfig.from || process.env.EMAIL_FROM || (this.currentConfig.user ? `AMR MUGOTE <${this.currentConfig.user}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: sans-serif; background-color: #0b192c; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #001233; color: #ffffff; padding: 24px; text-align: center; border-bottom: 4px solid #f59e0b; }
    .body-content { padding: 26px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0; text-transform:uppercase;">AMR MUGOTE ET SES FRÈRES</h2>
      <p style="margin:6px 0 0 0; color:#f59e0b; font-size:12px;">Agenda Serveur & Alertes Bateau en Temps Réel</p>
    </div>
    <div class="body-content">
      <p>Bonjour <strong>${agendaItem.fullName}</strong>,</p>
      <p>Votre voyage sur le bateau <strong>${agendaItem.ship}</strong> le <strong>${agendaItem.travelDate}</strong> à <strong>${agendaItem.departureTime}</strong> est bien surveillé en direct par le serveur central.</p>
      <p>Billet: <strong>${agendaItem.ticketId}</strong> • Embarquement dès <strong>${agendaItem.boardingTime}</strong>.</p>
    </div>
  </div>
</body>
</html>
    `;

    if (this.isConfigured) {
      const sendRes = await this.executeSendMail({
        from,
        to: recipient,
        subject,
        html,
        text: `Traversée ${agendaItem.ship} enregistrée à l'agenda en temps réel. Billet: ${agendaItem.ticketId}.`
      });

      if (sendRes.success) {
        return { success: true, recipient, subject, messageId: sendRes.messageId };
      }
      return { success: false, recipient, subject, error: sendRes.error };
    }

    return {
      success: true,
      simulated: true,
      recipient,
      subject,
      messageId: `sim-agenda-${Date.now()}`
    };
  }

  // =========================================================================
  // 5. ALERTES EN DIRECT BATEAU
  // =========================================================================
  public async sendBoatAlertNotification(params: {
    email: string;
    fullName: string;
    ticketId: string;
    ship: string;
    alertTitle: string;
    alertMessage: string;
    departureTime: string;
    travelDate: string;
    boatStatusText?: string;
  }): Promise<EmailSendResult> {
    if (!params.email || !params.email.includes('@')) {
      return {
        success: false,
        recipient: params.email || 'N/A',
        subject: params.alertTitle,
        error: "Adresse email manquante."
      };
    }

    const recipient = params.email.trim();
    const subject = `⚠️ ALERTE BATEAU [${params.ship}] - ${params.alertTitle} (Billet: ${params.ticketId})`;
    const from = this.currentConfig.from || process.env.EMAIL_FROM || (this.currentConfig.user ? `AMR MUGOTE <${this.currentConfig.user}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    const html = `
      <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 2px solid #e2e8f0; padding: 20px;">
        <h3 style="color: #d97706; margin-top: 0;">⚠️ Information Bateau en Direct - ${params.ship}</h3>
        <p>Bonjour <strong>${params.fullName}</strong>,</p>
        <div style="background: #fffbeb; border-left: 4px solid #d97706; padding: 14px; margin: 14px 0; color: #78350f;">
          <strong>${params.alertTitle}</strong><br>${params.alertMessage}
        </div>
        <p style="font-size: 12px; color: #64748b;">Voyage: ${params.travelDate} à ${params.departureTime} • Billet N° ${params.ticketId}</p>
      </div>
    `;

    if (this.isConfigured) {
      const sendRes = await this.executeSendMail({
        from,
        to: recipient,
        subject,
        html,
        text: `ALERTE ${params.ship}: ${params.alertTitle}\n${params.alertMessage}`
      });

      if (sendRes.success) {
        return { success: true, recipient, subject, messageId: sendRes.messageId };
      }
      return { success: false, recipient, subject, error: sendRes.error };
    }

    return {
      success: true,
      simulated: true,
      recipient,
      subject,
      messageId: `sim-alert-${Date.now()}`
    };
  }
}

export const emailService = new EmailService();
