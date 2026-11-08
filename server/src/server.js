import app from './app.js';
import { env } from './config/env.js';
import { ensureAdminAuth } from './config/pocketbase.js';
import { seedDefaultPlans } from './services/subscription.service.js';

const server = app.listen(env.PORT, async () => {
  console.log(`ShopFinder server running on port ${env.PORT} [${env.NODE_ENV}]`);
  try {
    await ensureAdminAuth();
    console.log('PocketBase Admin SDK client authenticated successfully');
    await seedDefaultPlans();
  } catch (err) {
    console.warn(`PocketBase initialization deferred: ${err.message}`);
  }
});

server.on('error', (err) => {
  console.error(`Server startup error: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default server;
