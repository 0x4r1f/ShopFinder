import app from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`ShopFinder server running on port ${env.PORT} [${env.NODE_ENV}]`);
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
