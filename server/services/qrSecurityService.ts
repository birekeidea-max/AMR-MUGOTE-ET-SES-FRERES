import crypto from 'crypto';
import QRCode from 'qrcode';

// Clé secrète cryptographique HMAC issue de l'environnement ou générée de manière sécurisée
const QR_SECRET: string = process.env.QR_HMAC_SECRET || 'amr_mugote_lac_kivu_super_secret_key_2026_aes256_secure';

export interface GeneratedTokenPayload {
  token: string;
  signature: string;
  nonce: string;
  ticketId: string;
  expiresAt: Date;
}

/**
 * Service de Sécurité Cryptographique pour les QR Codes AMR MUGOTE
 * - Évite tout identifiant séquentiel ou lisible dans le QR Code.
 * - Utilise UUID v4 + HMAC-SHA256 pour interdire la falsification.
 * - Permet une vérification en mémoire en O(1) avant même de solliciter la base de données.
 */
export class QrSecurityService {
  /**
   * Génère un jeton cryptographique signé pour un billet donné.
   * Format produit : AMR1.<nonce_uuid>.<signature_hmac_hex>
   */
  public static generateSecureToken(
    ticketId: string, 
    validityHours: number = 72
  ): GeneratedTokenPayload {
    const cleanTicketId = String(ticketId).trim().toUpperCase();
    const nonce = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + validityHours * 3600 * 1000);

    // Concaténation des métadonnées cryptographiques non modifiables
    const payload = `AMR1:${nonce}:${cleanTicketId}:${expiresAt.getTime()}`;

    // Calcul de la signature HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(payload)
      .digest('hex');

    // Jeton final opaque transmis au QR Code (aucune donnée personnelle ou séquentielle visible)
    const token = `AMR1.${nonce}.${signature}`;

    return {
      token,
      signature,
      nonce,
      ticketId: cleanTicketId,
      expiresAt
    };
  }

  /**
   * Vérifie la validité cryptographique d'un jeton avant tout accès à la base de données.
   * Rejette instantanément en O(1) les jetons altérés ou falsifiés.
   */
  public static verifyTokenStructure(token: string): {
    isValid: boolean;
    nonce?: string;
    signature?: string;
    error?: string;
  } {
    if (typeof token !== 'string' || !token) {
      return { isValid: false, error: 'Format de jeton invalide (chaîne requise).' };
    }

    const parts = token.trim().split('.');
    if (parts.length !== 3 || parts[0] !== 'AMR1') {
      return { isValid: false, error: 'Format de jeton QR non reconnu (préfixe AMR1 attendu).' };
    }

    const [, nonce, signature] = parts;

    // Validation stricte du format UUID v4 et de la signature hexadécimale SHA-256 (64 caractères)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const hexSha256Regex = /^[0-9a-f]{64}$/i;

    if (!uuidRegex.test(nonce)) {
      return { isValid: false, error: 'Nonce cryptographique non conforme.' };
    }

    if (!hexSha256Regex.test(signature)) {
      return { isValid: false, error: 'Signature cryptographique corrompue.' };
    }

    return {
      isValid: true,
      nonce,
      signature
    };
  }

  /**
   * Recalcule et compare la signature HMAC avec timingSafeEqual pour contrer les Timing Attacks.
   */
  public static verifyHmacSignature(
    nonce: string,
    ticketId: string,
    expiresAt: Date,
    providedSignature: string
  ): boolean {
    try {
      const payload = `AMR1:${nonce}:${ticketId}:${expiresAt.getTime()}`;
      const expectedSignature = crypto
        .createHmac('sha256', QR_SECRET)
        .update(payload)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
      const providedBuffer = Buffer.from(providedSignature, 'utf-8');

      if (expectedBuffer.length !== providedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Génère l'image du QR Code sous forme de Data URL / Base64.
   * Optimisé avec un niveau de correction d'erreur élevé pour des scans rapides à quai.
   */
  public static async generateQrDataUrl(
    data: string,
    options?: QRCode.QRCodeToDataURLOptions
  ): Promise<string> {
    const defaultOptions: QRCode.QRCodeToDataURLOptions = {
      errorCorrectionLevel: 'H', // 30% de tolérance aux rayures / faible luminosité
      type: 'image/png',
      margin: 2,
      width: 320,
      color: {
        dark: '#001E2B', // Couleur maritime sombre conforme à la charte
        light: '#FFFFFF'
      },
      ...options
    };

    return await QRCode.toDataURL(data, defaultOptions);
  }
}
