import { Request, Response, NextFunction } from 'express';

// =========================================================================
// 1. PROTECTION ANTI-NOSQL INJECTION
// =========================================================================

/**
 * Middleware strict de désinfection et de validation des entrées pour contrer
 * toute tentative d'injection NoSQL (ex: { "$gt": "" }, { "$ne": null }, regex injections).
 */
export function sanitizeQrScanInput(req: Request, res: Response, next: NextFunction) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Corps de requête JSON manquant ou non valide.'
    });
  }

  const { token, scannerId } = body;

  // 1. Le jeton doit impérativement être une chaîne de caractères primitive
  if (typeof token !== 'string') {
    return res.status(400).json({
      success: false,
      error: "Type invalide : le jeton 'token' doit obligatoirement être une chaîne de caractères."
    });
  }

  const cleanToken = token.trim();

  // 2. Détection et blocage de tout opérateur ou caractère suspect MongoDB
  const dangerousPatterns = /[\${}[\]]/;
  if (dangerousPatterns.test(cleanToken)) {
    return res.status(400).json({
      success: false,
      error: 'Jeton invalide : caractères interdits détectés (tentative potentielle d’injection NoSQL).'
    });
  }

  // 3. Validation de structure stricte par expression régulière
  // Format attendu : AMR1.<uuid-v4>.<64-hex-signature>
  const strictQrRegex = /^AMR1\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}$/i;
  if (!strictQrRegex.test(cleanToken)) {
    return res.status(400).json({
      success: false,
      error: 'Format cryptographique du jeton QR invalide ou altéré.'
    });
  }

  // Nettoyage et injection de la valeur saine validée
  req.body.token = cleanToken;

  if (scannerId && typeof scannerId === 'string') {
    req.body.scannerId = scannerId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  } else {
    req.body.scannerId = 'TERMINAL_PORT_DEFAULT';
  }

  next();
}

// =========================================================================
// 2. RATE LIMITING (LIMITATION DU DÉBIT ANTI-FORCE BRUTE)
// =========================================================================

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Nettoyage périodique automatique du cache mémoire toutes les 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Middleware de limitation de débit (Rate Limiter) par fenêtre glissante :
 * - 60 requêtes de vérification par minute par adresse IP.
 * - Bloque les attaques de force brute et l'énumération automatisée de jetons.
 */
export function qrVerifyRateLimiter(
  maxRequests: number = 60,
  windowSeconds: number = 60
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = (
      req.headers['x-forwarded-for'] as string || 
      req.socket.remoteAddress || 
      '127.0.0.1'
    ).split(',')[0].trim();

    const key = `qr_verify:${clientIp}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        success: false,
        error: `Trop de tentatives de scan. Veuillez patienter ${retryAfter} seconde(s) avant de recommencer.`,
        retryAfter
      });
    }

    next();
  };
}
