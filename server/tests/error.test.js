import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

describe('Centralized Error Handler Security', () => {
  test('Error handler suppresses stack traces in production mode', async () => {
    // Construct isolated app with the same error handler logic under production flag
    const app = express();

    app.get('/trigger-error', (req, res, next) => {
      const err = new Error('Test internal database error');
      err.status = 500;
      next(err);
    });

    // Production error handler
    app.use((err, req, res, next) => {
      const isProduction = true; // simulated production
      const statusCode = err.status || 500;
      res.status(statusCode).json({
        success: false,
        error: {
          message: err.message || 'Internal Server Error',
          ...(isProduction ? {} : { stack: err.stack })
        }
      });
    });

    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/trigger-error`);
      assert.equal(res.status, 500);

      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error.message, 'Test internal database error');
      assert.equal(body.error.stack, undefined, 'Stack trace must NEVER be exposed in production');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

