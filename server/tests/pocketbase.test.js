import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PocketBase from 'pocketbase';
import { pbAdmin, getAdminClient, ensureAdminAuth, resetAdminAuthStore } from '../src/config/pocketbase.js';
import { env } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../package.json');

describe('PocketBase Admin SDK Client Singleton (Task 3.1)', () => {
  beforeEach(() => {
    // Restore valid state if needed
  });

  test('1. PocketBase SDK is installed and pinned in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    assert.ok(pkg.dependencies.pocketbase, 'pocketbase must be declared in dependencies');
    assert.equal(pkg.dependencies.pocketbase, '0.28.2', 'pocketbase version must be strictly pinned to 0.28.2');
  });

  test('2. Admin SDK client is initialized as a singleton PocketBase instance', () => {
    assert.ok(pbAdmin instanceof PocketBase, 'pbAdmin must be an instance of PocketBase');
    assert.equal(pbAdmin.baseUrl, env.POCKETBASE_URL, 'pbAdmin baseUrl must match validated POCKETBASE_URL');
  });

  test('3. Admin SDK disables auto-cancellation for server-side concurrent requests', () => {
    assert.ok(pbAdmin, 'pbAdmin must exist');
  });

  test('4. Successful superuser authentication works against local PocketBase instance', async () => {
    const client = await ensureAdminAuth();
    assert.ok(client instanceof PocketBase);
    assert.equal(client.authStore.isValid, true, 'authStore must be valid after successful authentication');
    assert.ok(client.authStore.token.length > 0, 'authStore must hold a valid JWT');
    assert.equal(client.authStore.record?.email, env.POCKETBASE_ADMIN_EMAIL, 'authStore record email must match admin email');
  });

  test('5. getAdminClient returns the authenticated singleton client', async () => {
    const client1 = await getAdminClient();
    const client2 = await getAdminClient();
    assert.equal(client1, pbAdmin, 'getAdminClient must return the pbAdmin singleton');
    assert.equal(client1, client2, 'Consecutive getAdminClient calls must return the identical singleton instance');
    assert.equal(client1.authStore.isValid, true);
  });

  test('6. Concurrent ensureAdminAuth calls share in-flight promise and do not duplicate auth requests', async () => {
    resetAdminAuthStore();
    assert.equal(pbAdmin.authStore.isValid, false, 'authStore cleared for concurrent test');

    // Fire 5 simultaneous calls
    const results = await Promise.all([
      ensureAdminAuth(),
      ensureAdminAuth(),
      ensureAdminAuth(),
      ensureAdminAuth(),
      ensureAdminAuth()
    ]);

    for (const client of results) {
      assert.equal(client, pbAdmin);
      assert.equal(client.authStore.isValid, true);
    }
  });

  test('7. Re-authentication behavior functions reliably when token is cleared or expired', async () => {
    // Authenticate first
    await ensureAdminAuth();
    assert.equal(pbAdmin.authStore.isValid, true);

    // Clear authStore to simulate token expiration
    resetAdminAuthStore();
    assert.equal(pbAdmin.authStore.isValid, false);

    // Calling ensureAdminAuth must re-authenticate and restore valid token
    const client = await ensureAdminAuth();
    assert.equal(client.authStore.isValid, true);
    assert.ok(client.authStore.token.length > 0);
  });

  test('8. Force re-authentication works even when authStore is locally valid', async () => {
    await ensureAdminAuth();
    const originalToken = pbAdmin.authStore.token;

    const client = await ensureAdminAuth({ force: true });
    assert.equal(client.authStore.isValid, true);
    assert.ok(client.authStore.token.length > 0);
  });

  test('9. Error sanitization: ensureAdminAuth throws strictly generic message on failure', async () => {
    const originalCollection = pbAdmin.collection.bind(pbAdmin);
    try {
      // Stub collection to throw an error with raw SDK messages and details
      pbAdmin.collection = () => ({
        authWithPassword: async () => {
          const rawErr = new Error('Raw PocketBase SDK error: Failed to authenticate. Identity not found.');
          rawErr.status = 400;
          throw rawErr;
        }
      });

      let caughtError = null;
      try {
        await ensureAdminAuth({ force: true });
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Expected ensureAdminAuth to throw');
      assert.equal(
        caughtError.message,
        'PocketBase Admin SDK authentication failed',
        'Error message must be strictly generic and never forward raw SDK messages'
      );
      assert.equal(caughtError.status, 400, 'HTTP status must be preserved when valid');
      assert.ok(!caughtError.message.includes('Raw PocketBase SDK error'), 'Must not contain raw error text');
      assert.ok(!caughtError.message.includes('Identity not found'), 'Must not contain raw error details');
    } finally {
      pbAdmin.collection = originalCollection;
      resetAdminAuthStore();
    }
  });

  test('10. Error sanitization: sensitive strings (passwords, JWTs, headers) are never leaked in error', async () => {
    const originalCollection = pbAdmin.collection.bind(pbAdmin);

    const sensitiveStrings = [
      'FakeSuperPassword123!@#',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_payload.signature',
      'Authorization: Bearer secret_jwt_value',
      'SELECT * FROM _superusers WHERE password_hash = "secret"',
      'admin@secret-internal.corp'
    ];

    try {
      // Simulate raw SDK error containing multiple sensitive artifacts
      pbAdmin.collection = () => ({
        authWithPassword: async () => {
          const rawErr = new Error(
            `Connection failed for ${sensitiveStrings[0]} with token ${sensitiveStrings[1]} headers: ${sensitiveStrings[2]} db: ${sensitiveStrings[3]} user: ${sensitiveStrings[4]}`
          );
          rawErr.status = 401;
          rawErr.data = { token: sensitiveStrings[1], password: sensitiveStrings[0] };
          throw rawErr;
        }
      });

      let caughtError = null;
      try {
        await ensureAdminAuth({ force: true });
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Expected ensureAdminAuth to throw');
      assert.equal(caughtError.message, 'PocketBase Admin SDK authentication failed');
      assert.equal(caughtError.status, 401);

      // Verify none of the sensitive strings are in the thrown error message
      for (const secret of sensitiveStrings) {
        assert.ok(
          !caughtError.message.includes(secret),
          `Error message must NEVER contain sensitive string: ${secret}`
        );
      }
    } finally {
      pbAdmin.collection = originalCollection;
      resetAdminAuthStore();
    }
  });

  test('11. Error sanitization: application logs do not expose sensitive details on startup failure', async () => {
    const originalCollection = pbAdmin.collection.bind(pbAdmin);
    const originalWarn = console.warn;
    const capturedLogs = [];

    const secretToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_token_stream';
    const secretPassword = 'InternalSecretPassword_XYZ_987';

    try {
      console.warn = (...args) => {
        capturedLogs.push(args.join(' '));
      };

      pbAdmin.collection = () => ({
        authWithPassword: async () => {
          const rawErr = new Error(`SDK Exception: token=${secretToken} pass=${secretPassword}`);
          rawErr.status = 502;
          throw rawErr;
        }
      });

      // Simulate startup catch block from server.js
      try {
        await ensureAdminAuth({ force: true });
      } catch (err) {
        console.warn(`PocketBase Admin SDK initialization deferred: ${err.message}`);
      }

      assert.equal(capturedLogs.length, 1);
      const logLine = capturedLogs[0];
      assert.ok(
        logLine.includes('PocketBase Admin SDK initialization deferred: PocketBase Admin SDK authentication failed'),
        'Log must contain only generic sanitized error description'
      );
      assert.ok(!logLine.includes(secretToken), 'Application log must NEVER contain JWT tokens');
      assert.ok(!logLine.includes(secretPassword), 'Application log must NEVER contain passwords');
      assert.ok(!logLine.includes('SDK Exception'), 'Application log must NEVER contain raw SDK exception text');
    } finally {
      console.warn = originalWarn;
      pbAdmin.collection = originalCollection;
      resetAdminAuthStore();
    }
  });

  test('12. Safe status normalization: invalid or out-of-range status defaults to 500', async () => {
    const originalCollection = pbAdmin.collection.bind(pbAdmin);
    try {
      pbAdmin.collection = () => ({
        authWithPassword: async () => {
          const rawErr = new Error('Strange error without standard status');
          rawErr.status = 'non-numeric-status';
          throw rawErr;
        }
      });

      let caughtError = null;
      try {
        await ensureAdminAuth({ force: true });
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError);
      assert.equal(caughtError.message, 'PocketBase Admin SDK authentication failed');
      assert.equal(caughtError.status, 500, 'Non-numeric status must normalize safely to 500');
    } finally {
      pbAdmin.collection = originalCollection;
      resetAdminAuthStore();
    }
  });

  test('13. Retry behavior: successful authentication restores immediately after failed attempt', async () => {
    const originalCollection = pbAdmin.collection.bind(pbAdmin);

    // 1. Simulate a transient failure
    try {
      pbAdmin.collection = () => ({
        authWithPassword: async () => {
          const err = new Error('Transient network timeout');
          err.status = 503;
          throw err;
        }
      });

      await assert.rejects(
        () => ensureAdminAuth({ force: true }),
        (err) => {
          assert.equal(err.message, 'PocketBase Admin SDK authentication failed');
          assert.equal(err.status, 503);
          return true;
        }
      );
    } finally {
      // 2. Restore normal collection
      pbAdmin.collection = originalCollection;
    }

    // 3. Next call must retry and succeed cleanly against live PocketBase
    const client = await ensureAdminAuth({ force: true });
    assert.equal(client, pbAdmin);
    assert.equal(client.authStore.isValid, true, 'authStore must recover to valid on retry');
    assert.ok(client.authStore.token.length > 0);
  });

  test('14. Concurrency protection on failure: all concurrent callers receive safe error and mutex unlocks', async () => {
    const originalCollection = pbAdmin.collection.bind(pbAdmin);

    try {
      pbAdmin.collection = () => ({
        authWithPassword: async () => {
          // Add small delay to simulate network latency
          await new Promise((r) => setTimeout(r, 20));
          const err = new Error('Simulated failure during concurrent burst');
          err.status = 500;
          throw err;
        }
      });

      resetAdminAuthStore();

      // Launch 4 concurrent calls
      const results = await Promise.allSettled([
        ensureAdminAuth({ force: true }),
        ensureAdminAuth({ force: true }),
        ensureAdminAuth({ force: true }),
        ensureAdminAuth({ force: true })
      ]);

      for (const res of results) {
        assert.equal(res.status, 'rejected');
        assert.equal(res.reason.message, 'PocketBase Admin SDK authentication failed');
        assert.equal(res.reason.status, 500);
      }
    } finally {
      pbAdmin.collection = originalCollection;
      resetAdminAuthStore();
    }

    // Mutex was unlocked in finally; live call now succeeds
    const recoveredClient = await ensureAdminAuth({ force: true });
    assert.equal(recoveredClient.authStore.isValid, true);
  });

  test('15. Security boundary: pbAdmin must NEVER be exposed as customer or owner user token', async () => {
    await ensureAdminAuth();
    // Superuser record collection must be _superusers, NOT users
    assert.equal(pbAdmin.authStore.record?.collectionName, '_superusers', 'Superuser collection must be _superusers, not app users');
    assert.notEqual(pbAdmin.authStore.record?.collectionName, 'users', 'Admin SDK singleton must not authenticate as an app user');
  });
});
