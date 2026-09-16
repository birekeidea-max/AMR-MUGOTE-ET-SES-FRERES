import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailSendResult {
  success: boolean;
  simulated?: boolean;
  messageId?: string;
  recipient: string;
  subject: string;
  error?: string;
}

export interface EmailStatusResponse {
  configured: boolean;
  provider: string;
  fromAddress: string;
  host: string;
  port: number;
  user: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  public initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
    const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
    const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';

    if (user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user,
            pass
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        this.isConfigured = true;
        console.log(`✅ [EmailService] SMTP configuré pour ${user} via ${host}:${port}`);
      } catch (err) {
        console.error("❌ [EmailService] Erreur lors de l'initialisation SMTP:", err);
        this.transporter = null;
        this.isConfigured = false;
      }
    } else {
      this.transporter = null;
      this.isConfigured = false;
      console.log("ℹ️ [EmailService] Aucun identifiant SMTP configuré. Mode simulation actif (journaux console).");
    }
  }

  public getStatus(): EmailStatusResponse {
    return {
      configured: this.isConfigured,
      provider: process.env.SMTP_HOST ? 'Custom SMTP' : 'Gmail SMTP (smtp.gmail.com)',
      fromAddress: process.env.EMAIL_FROM || (process.env.SMTP_USER ? `AMR MUGOTE <${process.env.SMTP_USER}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>'),
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      user: process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***@gmail.com` : 'Non configuré'
    };
  }

  /**
   * Envoi d'un rappel d'heure de départ à un passager par Gmail / Email
   */
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

    // Calcul de l'heure conseillée d'embarquement (45 min avant)
    let boardingAdvice = "Arrivée recommandée 45 minutes avant le départ";
    try {
      const parts = departureTime.replace('h', ':').split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        m -= 45;
        if (m < 0) {
          m += 60;
          h -= 1;
        }
        const hStr = h < 10 ? `0${h}` : `${h}`;
        const mStr = m < 10 ? `0${m}` : `${m}`;
        boardingAdvice = `Présentez-vous au port d'embarquement dès ${hStr}h${mStr} (au moins 45 minutes avant)`;
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #001233 0%, #0A2540 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
    .gold-pill { display: inline-block; background: #d97706; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 4px 14px; border-radius: 20px; margin-bottom: 12px; }
    .title { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
    .subtitle { margin: 8px 0 0 0; color: #cbd5e1; font-size: 13px; font-weight: 500; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 16px; color: #334155; margin-bottom: 20px; line-height: 1.6; }
    
    .highlight-card { background: #f8fafc; border: 2px solid #0284c7; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
    .highlight-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 1px; margin-bottom: 12px; }
    
    .departure-hero { text-align: center; background: #001233; color: #ffffff; border-radius: 12px; padding: 18px 12px; margin-bottom: 16px; }
    .departure-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #f59e0b; font-weight: 800; }
    .departure-time { font-size: 38px; font-weight: 900; letter-spacing: -1px; margin: 4px 0; color: #ffffff; }
    .departure-date { font-size: 14px; color: #94a3b8; font-weight: 600; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .info-box { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .info-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .info-val { font-size: 14px; font-weight: 800; color: #0f172a; }
    
    .advice-box { background: #fef3c7; border-left: 4px solid #d97706; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: 13px; color: #78350f; font-weight: 600; line-height: 1.5; }
    
    .instructions { background: #f8fafc; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .instructions h4 { margin: 0 0 10px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
    .instructions ul { margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6; }
    
    .contacts { border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; text-align: center; }
    .contacts strong { color: #0f172a; }
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
        La compagnie <strong>AMR MUGOTE ET SES FRÈRES</strong> a le plaisir de vous rappeler l'heure de départ de votre prochain voyage sur le lac Kivu.
      </p>

      <div class="highlight-card">
        <div class="highlight-title">⚓ Détails de votre Traversée</div>

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
            <div class="info-label">Bateau Assigne</div>
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
      </div>

      <div class="advice-box">
        ⚠️ <strong>Consigne d'Embarquement :</strong> ${boardingAdvice}. Les portes d'accès aux quais ferment 15 minutes avant le largage des amarres.
      </div>

      <div class="instructions">
        <h4>📋 Rappels pour votre Embarquement</h4>
        <ul>
          <li><strong>Billet :</strong> Ayez votre billet électronique (QR code sur votre téléphone) ou votre billet imprimé prêt pour le contrôle.</li>
          <li><strong>Pièce d'Identité :</strong> Munissez-vous d'une pièce d'identité valide (Carte d'électeur, Passeport ou Permis de conduire).</li>
          <li><strong>Bagages :</strong> Étiquetez vos bagages avant la remise au personnel de bord.</li>
        </ul>
      </div>

      <div class="contacts">
        <strong>Besoin d'assistance ou d'un renseignement ?</strong><br>
        Contact Port Bukavu : <strong>+243 994 102 673</strong> | Contact Port Goma : <strong>+243 816 680 709</strong><br>
        Email : birekeidea@gmail.com
      </div>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} AMR MUGOTE ET SES FRÈRES. Tous droits réservés.<br>
      Ce message automatique vous est envoyé car vous avez réservé avec votre compte Gmail.
    </div>
  </div>
</body>
</html>
    `;

    const from = process.env.EMAIL_FROM || (process.env.SMTP_USER ? `AMR MUGOTE <${process.env.SMTP_USER}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    // Mode Réel si configuré
    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: recipient,
          subject,
          html,
          text: `Bonjour ${passengerName},\n\nRappel de départ AMR MUGOTE ET SES FRÈRES.\nBillet: ${ticketId}\nTrajet: ${itinerary}\nDate: ${travelDate}\nHeure de départ: ${departureTime}\nBateau: ${ship}\nClasse: ${travelClass}\n\n${boardingAdvice}.\nContacts: +243 994 102 673 / +243 816 680 709.`
        });

        console.log(`✅ [EmailService] Rappel Gmail envoyé avec succès à ${recipient} (Message ID: ${info.messageId})`);
        return {
          success: true,
          recipient,
          subject,
          messageId: info.messageId
        };
      } catch (err: any) {
        console.error(`❌ [EmailService] Échec de l'envoi SMTP à ${recipient}:`, err);
        return {
          success: false,
          recipient,
          subject,
          error: err.message || String(err)
        };
      }
    }

    // Mode Simulation (dev ou identifiants en attente de configuration)
    console.log(`📫 [EmailService SIMULATION] Rappel de départ préparé pour ${recipient}:`);
    console.log(`   - Sujet: ${subject}`);
    console.log(`   - Voyageur: ${passengerName} (${ticketId})`);
    console.log(`   - Départ: ${travelDate} à ${departureTime} sur ${ship}`);
    console.log(`   - Note: Configurez SMTP_USER et SMTP_PASS dans les paramètres pour un acheminement direct par Gmail.`);

    return {
      success: true,
      simulated: true,
      recipient,
      subject,
      messageId: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
  }

  /**
   * Envoi d'un email de test pour valider les paramètres SMTP
   */
  public async sendTestEmail(targetEmail: string): Promise<EmailSendResult> {
    const subject = "⚓ Test de Connectivité Email - AMR MUGOTE ET SES FRÈRES";
    const from = process.env.EMAIL_FROM || (process.env.SMTP_USER ? `AMR MUGOTE <${process.env.SMTP_USER}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    const html = `
      <div style="font-family: sans-serif; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #cbd5e1;">
        <h2 style="color: #001233;">⚓ Test de Connexion Email Réussi</h2>
        <p>Ce message confirme que le service d'envoi d'emails et de rappels de départ de <strong>AMR MUGOTE ET SES FRÈRES</strong> fonctionne correctement.</p>
        <p>Les voyageurs ayant renseigné leur Gmail recevront leurs rappels d'heure de départ à cette adresse.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
        <small style="color: #64748b;">Horodatage : ${new Date().toLocaleString('fr-FR')}</small>
      </div>
    `;

    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: targetEmail,
          subject,
          html,
          text: "Test réussi pour AMR MUGOTE ET SES FRÈRES."
        });
        return {
          success: true,
          recipient: targetEmail,
          subject,
          messageId: info.messageId
        };
      } catch (err: any) {
        return {
          success: false,
          recipient: targetEmail,
          subject,
          error: err.message || String(err)
        };
      }
    }

    return {
      success: true,
      simulated: true,
      recipient: targetEmail,
      subject,
      messageId: `sim-test-${Date.now()}`
    };
  }

  /**
   * Confirmation d'inscription automatique à l'Agenda en temps réel du serveur pour les notifications bateau
   */
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
    const subject = `⚓ Billet ${agendaItem.ticketId} - Inscrit à l'Agenda & Alertes Bateau en Temps Réel [AMR MUGOTE]`;
    const from = process.env.EMAIL_FROM || (process.env.SMTP_USER ? `AMR MUGOTE <${process.env.SMTP_USER}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b192c; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,0.25); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #001233 0%, #032b69 100%); color: #ffffff; padding: 26px 30px; text-align: center; border-bottom: 4px solid #f59e0b; }
    .header h1 { margin: 0; font-size: 20px; letter-spacing: 2px; text-transform: uppercase; color: #ffffff; }
    .header p { margin: 6px 0 0 0; font-size: 11px; color: #f59e0b; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; }
    .body-content { padding: 28px 30px; }
    .welcome { font-size: 15px; color: #0f172a; margin-bottom: 16px; line-height: 1.6; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; border: 1px solid #10b981; color: #065f46; padding: 6px 14px; border-radius: 9999px; font-weight: 800; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 20px; }
    .agenda-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 20px; }
    .agenda-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #032b69; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-item { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; }
    .label { font-size: 9px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.5px; margin-bottom: 3px; }
    .value { font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace; }
    .value-highlight { font-size: 16px; font-weight: 900; color: #d97706; }
    .realtime-callout { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 0 12px 12px 0; margin-bottom: 20px; font-size: 12px; color: #1e40af; line-height: 1.5; }
    .footer { background: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>AMR MUGOTE ET SES FRÈRES</h1>
      <p>Agenda Serveur & Alertes Bateau en Temps Réel</p>
    </div>
    <div class="body-content">
      <div class="status-badge">
        ✓ Enregistré dans l'Agenda en Temps Réel du Serveur
      </div>
      <p class="welcome">
        Bonjour <strong>${agendaItem.fullName}</strong>,<br>
        Votre adresse Gmail a été connectée avec succès au serveur central d'<strong>AMR MUGOTE</strong>. Le serveur surveillera en direct votre traversée sur le Lac Kivu et vous transmettra les alertes en temps réel.
      </p>

      <div class="agenda-box">
        <div class="agenda-title">📅 Fiche de Traversée au Calendrier Serveur</div>
        <div class="grid">
          <div class="grid-item">
            <div class="label">Bateau Assigné</div>
            <div class="value">${agendaItem.ship}</div>
          </div>
          <div class="grid-item">
            <div class="label">Trajet Prévu</div>
            <div class="value">${agendaItem.itinerary}</div>
          </div>
          <div class="grid-item">
            <div class="label">Date de Départ</div>
            <div class="value">${agendaItem.travelDate}</div>
          </div>
          <div class="grid-item">
            <div class="label">Heure de Départ</div>
            <div class="value value-highlight">${agendaItem.departureTime}</div>
          </div>
          <div class="grid-item">
            <div class="label">Embarquement Recommandé</div>
            <div class="value">${agendaItem.boardingTime}</div>
          </div>
          <div class="grid-item">
            <div class="label">N° de Billet</div>
            <div class="value">${agendaItem.ticketId}</div>
          </div>
        </div>
      </div>

      <div class="realtime-callout">
        🔔 <strong>Comment fonctionne la surveillance en temps réel ?</strong><br>
        Le serveur central d'AMR Mugote met à jour les informations en continu (bateau à quai, ouverture des portes d'embarquement, début de largage des amarres, confirmation météo). Si une modification horaire ou un avis prioritaire survient, vous recevrez une notification instantanée à cette adresse Gmail.
      </div>

      <p style="font-size: 11px; color: #475569; margin-top: 14px;">
        Pour toute assistance au port ou renseignement sur votre départ, notre équipe reste joignable au <strong>+243 994 102 673</strong> et <strong>+243 816 680 709</strong>.
      </p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} AMR MUGOTE ET SES FRÈRES • Transport Lacustre Bukavu - Goma<br>
      Notification automatique émise par le service d'agenda en temps réel du serveur.
    </div>
  </div>
</body>
</html>
    `;

    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: recipient,
          subject,
          html,
          text: `Bonjour ${agendaItem.fullName},\n\nVotre traversée sur ${agendaItem.ship} (${agendaItem.itinerary}) le ${agendaItem.travelDate} à ${agendaItem.departureTime} est enregistrée dans l'agenda en temps réel du serveur AMR MUGOTE.\nBillet: ${agendaItem.ticketId}\nEmbarquement: dès ${agendaItem.boardingTime}.\n\nVous recevrez les notifications en direct concernant votre bateau.`
        });
        console.log(`✅ [EmailService] Confirmation d'agenda envoyée à ${recipient} (Message ID: ${info.messageId})`);
        return { success: true, recipient, subject, messageId: info.messageId };
      } catch (err: any) {
        console.error(`❌ [EmailService] Erreur envoi confirmation agenda à ${recipient}:`, err);
        return { success: false, recipient, subject, error: err.message || String(err) };
      }
    }

    console.log(`📫 [EmailService SIMULATION] Confirmation d'agenda pour ${recipient}:`);
    console.log(`   - Bateau: ${agendaItem.ship} (${agendaItem.departureTime} le ${agendaItem.travelDate})`);
    console.log(`   - Sujet: ${subject}`);

    return {
      success: true,
      simulated: true,
      recipient,
      subject,
      messageId: `sim-agenda-${Date.now()}`
    };
  }

  /**
   * Envoi d'une alerte en temps réel concernant le bateau (retard, embarquement en cours, départ immédiat)
   */
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
    const from = process.env.EMAIL_FROM || (process.env.SMTP_USER ? `AMR MUGOTE <${process.env.SMTP_USER}>` : 'AMR MUGOTE ET SES FRÈRES <no-reply@amrmugote.com>');

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; padding: 20px; color: #1e293b; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 2px solid #e2e8f0; box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
    .banner { background: #d97706; color: #ffffff; padding: 20px 24px; text-align: center; }
    .banner h2 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 24px 28px; }
    .alert-box { background: #fffbeb; border: 2px solid #fef3c7; border-left: 5px solid #d97706; border-radius: 8px; padding: 14px 18px; margin: 16px 0; font-size: 13px; line-height: 1.6; color: #78350f; }
    .details { background: #f8fafc; border-radius: 10px; padding: 12px 16px; font-size: 12px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="banner">
      <h2>AMR MUGOTE - Information Bateau en Direct</h2>
    </div>
    <div class="content">
      <p>Bonjour <strong>${params.fullName}</strong>,</p>
      <div class="alert-box">
        <strong>${params.alertTitle}</strong><br>
        ${params.alertMessage}
      </div>
      <div class="details">
        <p style="margin: 4px 0;"><strong>Bateau :</strong> ${params.ship}</p>
        <p style="margin: 4px 0;"><strong>Date & Heure :</strong> ${params.travelDate} à ${params.departureTime}</p>
        <p style="margin: 4px 0;"><strong>Statut Bateau :</strong> ${params.boatStatusText || 'Mise à jour en temps réel'}</p>
        <p style="margin: 4px 0;"><strong>N° Billet :</strong> ${params.ticketId}</p>
      </div>
      <p style="font-size: 11px; color: #64748b;">
        Cette notification a été émise automatiquement par le serveur central d'AMR Mugote à destination des passagers enregistrés à l'agenda de ce voyage.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from,
          to: recipient,
          subject,
          html,
          text: `ALERTE BATEAU ${params.ship}: ${params.alertTitle}\n${params.alertMessage}\nDate: ${params.travelDate} - Heure: ${params.departureTime}\nBillet: ${params.ticketId}`
        });
        return { success: true, recipient, subject, messageId: info.messageId };
      } catch (err: any) {
        return { success: false, recipient, subject, error: err.message || String(err) };
      }
    }

    console.log(`📫 [EmailService SIMULATION] Alerte Bateau temps réel pour ${recipient}: ${subject}`);
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

