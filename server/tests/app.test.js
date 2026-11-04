import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

describe('Express Server Foundation (Task 1.2)', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Start on ephemeral port 0 for collision-free testing
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /health returns 200 with status ok and timestamp (no sensitive data)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp, 'Timestamp must be present');
    assert.equal(typeof body.timestamp, 'string');

    // Confirm no sensitive fields are present
    assert.equal(body.password, undefined);
    assert.equal(body.secret, undefined);
    assert.equal(body.env, undefined);
    assert.equal(body.database, undefined);
  });

  test('GET /non-existent-route returns structured 404 JSON', async () => {
    const res = await fetch(`${baseUrl}/non-existent-route`);
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error, 'Error object must be present');
    assert.ok(body.error.message.includes('Route not found'));
  });

  test('CORS headers allow authorized frontend origin with credentials', async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: 'http://localhost:5173'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  });

  test('Security headers (Helmet) are present on responses', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    // Helmet security headers
    assert.ok(res.headers.get('x-content-type-options'), 'X-Content-Type-Options should be set');
    assert.ok(res.headers.get('x-dns-prefetch-control'), 'X-DNS-Prefetch-Control should be set');
  });
});

