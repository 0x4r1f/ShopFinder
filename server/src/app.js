import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { csrfProtect } from './middleware/csrf.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import listingRoutes from './routes/listing.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import adminRoutes from './routes/admin.routes.js';
import favoritesRoutes from './routes/favorites.routes.js';
import customerRoutes from './routes/customer.routes.js';
import subscriptionsRoutes from './routes/subscriptions.routes.js';
import revealRoutes from './routes/reveal.routes.js';

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

// 5. Authentication API Routes (Phase 3, Task 3.2)
app.use('/api/v1/auth', authRoutes);

// 6. User Profile API Routes (Phase 3, Task 3.6)
app.use('/api/v1/users', userRoutes);

// 7. Public Listing API Routes (Phase 5, Task 5.1)
app.use('/api/v1/listings', listingRoutes);

// 8. Owner Portal API Routes (Phase 6, Task 6.2)
app.use('/api/v1/owner', ownerRoutes);

// 9. Admin Portal API Routes (Phase 7, Task 7.1)
app.use('/api/v1/admin', adminRoutes);

// 10. Customer Favorites API Routes (Phase 8, Task 8.1)
app.use('/api/v1/favorites', favoritesRoutes);

// 11. Customer Portal API Routes (Phase 8, Task 8.2)
app.use('/api/v1/customer', customerRoutes);

// 12. Subscription Plans API Routes (Phase 9, Task 9.2)
app.use('/api/v1/subscriptions', subscriptionsRoutes);

// 13. Contact Reveal API Routes (Phase 10, Task 10.7)
app.use('/api/v1/reveal', revealRoutes);

// 14. Health Check Endpoint (Free of sensitive info)
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

// 7. Centralized Error Handler (Never expose stack traces in client responses)
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;

  // Retain diagnostics in server logs for 5xx errors while keeping client responses clean
  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error'
    }
  });
});

export default app;
