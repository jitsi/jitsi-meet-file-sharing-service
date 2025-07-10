import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';

import { IJwtPayload } from '../types';

const JWT_PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || '';

let publicKey: string | null = null;

// Load public key from file
if (JWT_PUBLIC_KEY_PATH) {
    try {
        publicKey = fs.readFileSync(JWT_PUBLIC_KEY_PATH, 'utf8');
        console.log('JWT public key loaded from:', JWT_PUBLIC_KEY_PATH);
        console.log('Key format:', publicKey.substring(0, 50) + '...');
    } catch (error) {
        console.error('Failed to load JWT public key from:', JWT_PUBLIC_KEY_PATH, error);
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
        res.status(401).json({ error: 'Access token required' });

        return;
    }

    try {
        let decoded: IJwtPayload;

        if (publicKey) {
            // Verify RS256 token with public key
            try {
                decoded = jwt.verify(token, publicKey, { algorithms: [ 'RS256' ] }) as IJwtPayload;
            } catch (keyError) {
                // Try without specifying algorithm
                decoded = jwt.verify(token, publicKey) as IJwtPayload;
            }
        } else {
            // For development/testing - skip verification
            decoded = jwt.decode(token) as IJwtPayload;
            console.warn('JWT_PUBLIC_KEY_PATH not set or key not loaded - skipping token verification');
        }

        // Check audience (can be string or array)
        const audience = Array.isArray(decoded.aud) ? decoded.aud : [ decoded.aud ];

        if (!audience.includes('file-sharing')) {
            res.status(403).json({ error: 'Invalid token audience' });

            return;
        }

        // Check issuer
        if (decoded.iss !== 'prosody') {
            res.status(403).json({ error: 'Invalid token issuer' });

            return;
        }

        (req as any).user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Middleware that requires file-upload feature (for upload/delete operations)
export const requireFileUploadFeature = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user?.context?.features?.['file-upload']) {
        res.status(403).json({ error: 'File upload feature not enabled' });

        return;
    }

    next();
};
