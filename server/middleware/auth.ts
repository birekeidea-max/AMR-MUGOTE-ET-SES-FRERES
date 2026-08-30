import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    role?: string;
    [key: string]: any;
  };
}

export async function verifyFirebaseAuth(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Authentification requise', 
      message: 'Aucun jeton d\'authentification Bearer fourni.' 
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Jeton invalide' });
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
    next();
  } catch (error: any) {
    console.warn('Firebase Auth Token Verification Warning:', error?.message || error);
    // Allow development fallback or inform client
    return res.status(401).json({ 
      error: 'Jeton expiré ou non valide',
      details: error?.message 
    });
  }
}

export async function optionalFirebaseAuth(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
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
    // Non-blocking for optional auth
    console.warn('Optional auth token invalid:', error);
  }
  next();
}
