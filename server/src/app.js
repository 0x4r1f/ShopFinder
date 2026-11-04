import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { csrfProtect } from './middleware/csrf.js';

const app = express();

// 1. Security Headers via Helmet
app.use(helmet());

// 2. CORS Configuration (Never use wildcard with credentials)
const allowedOrigin = env.CLIENT_URL;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, server-to-server) or matching frontend origin
      if (!origin || origin === allowedOrigin) {
        callback(null, true);
      } else {
        const corsError = new Error('Not allowed by CORS policy');
        corsError.status = 403;
        callback(corsError);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// 3. Body & Cookie Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// 4. CSRF Protection for state-changing HTTP requests (D-010)
app.use(csrfProtect);

// 5. Health Check Endpoint (Free of sensitive info)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 6. Centralized 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
});

// 7. Centralized Error Handler (No stack traces in production)
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = env.isProduction;

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(isProduction ? {} : { stack: err.stack })
    }
  });
});

export default app;

