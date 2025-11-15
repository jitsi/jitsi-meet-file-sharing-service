import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import documentRoutes from './routes/documents';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS is handled by Nginx, so disable it in Node.js
// app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// OPTIONS requests are handled by Nginx

app.use('/v1/documents', documentRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`File sharing service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
