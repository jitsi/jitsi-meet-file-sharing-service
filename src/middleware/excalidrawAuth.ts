import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface FirebaseUser {
  name?: string;
  email?: string;
  user_id: string;
  email_verified?: boolean;
}

interface AuthRequest extends Request {
  user?: FirebaseUser;
}

export const verifyFirebaseToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.decode(token) as any;
    
    if (!decoded) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    if (!decoded.iss || !decoded.iss.includes('securetoken.google.com')) {
      res.status(401).json({ error: 'Not a Firebase token' });
      return;
    }

    if (!decoded.user_id || !decoded.firebase) {
      res.status(401).json({ error: 'Invalid Firebase token' });
      return;
    }

    const projectId = decoded.iss.replace('https://securetoken.google.com/', '');
    if (decoded.aud !== projectId) {
      res.status(401).json({ error: 'Invalid token audience' });
      return;
    }

    req.user = {
      name: decoded.name,
      email: decoded.email,
      user_id: decoded.user_id,
      email_verified: decoded.email_verified
    };

    console.log('Firebase token verified for:', decoded.email || decoded.user_id);
    next();

  } catch (error) {
    res.status(401).json({ error: 'Token verification failed' });
  }
};

export const skipAuthForDev = (req: AuthRequest, res: Response, next: NextFunction): void => {
  console.log('Dev mode skipping auth');
  req.user = {
    user_id: 'user',
    email: 'mail@example.com',
    name: 'user'
  };
  next();
};

export type { FirebaseUser, AuthRequest };
