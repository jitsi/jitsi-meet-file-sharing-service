import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import documentRoutes from './routes/documents';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost'; // Defaults to localhost if not specified

// Remove the default Express fingerprinting header.
app.disable('x-powered-by');

// Security headers applied to every response.
app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Simple in-memory rate limiter.
// For a multi-process / multi-node deployment replace this with a shared
// store (e.g. Redis via express-rate-limit + rate-limit-redis).
interface RateLimitEntry { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateLimitEntry>();

function makeRateLimiter(maxRequests: number, windowMs: number) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
        const now = Date.now();
        const entry = rateLimitStore.get(ip);

        if (!entry || entry.resetAt <= now) {
            rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
            next();

            return;
        }

        if (entry.count < maxRequests) {
            entry.count++;
            next();

            return;
        }

        res.status(429).json({ error: 'Too many requests, please try again later' });
    };
}

// Broad limit: 200 requests per 15 minutes for all API routes.
const apiRateLimiter = makeRateLimiter(200, 15 * 60 * 1000);

// Tighter limit on the unauthenticated-by-JWT download endpoint.
const downloadRateLimiter = makeRateLimiter(60, 15 * 60 * 1000);

// CORS is handled by Nginx, so disable it in Node.js
// app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// OPTIONS requests are handled by Nginx

app.use('/v1/documents/download', downloadRateLimiter);
app.use('/v1/documents', apiRateLimiter, documentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(Number(PORT), HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});
