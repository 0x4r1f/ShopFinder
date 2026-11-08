import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { envSchema, validateEnv } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../ShopFinder');
const serverDir = path.resolve(__dirname, '..');

describe('Environment Configuration & Validation (Task 1.3)', () => {
  const validBase = {
    NODE_ENV: 'development',
    PORT: '4000',
    CLIENT_URL: 'http://localhost:5173',
    POCKETBASE_URL: 'http://127.0.0.1:8090',
    POCKETBASE_ADMIN_EMAIL: 'admin@shopfinder.local',
    POCKETBASE_ADMIN_PASSWORD: 'mock-admin-password'
  };

  test('Valid development configuration parses cleanly and types correctly', () => {
    const config = validateEnv(validBase);
    assert.equal(config.NODE_ENV, 'development');
    assert.equal(config.PORT, 4000);
    assert.equal(config.CLIENT_URL, 'http://localhost:5173');
    assert.equal(config.POCKETBASE_URL, 'http://127.0.0.1:8090');
    assert.equal(config.POCKETBASE_ADMIN_EMAIL, 'admin@shopfinder.local');
    assert.equal(config.POCKETBASE_ADMIN_PASSWORD, 'mock-admin-password');
    assert.equal(config.isDevelopment, true);
    assert.equal(config.isProduction, false);
    assert.equal(config.isTest, false);
  });

  test('Missing CLIENT_URL triggers validation error', () => {
    const input = { ...validBase };
    delete input.CLIENT_URL;

    assert.throws(
      () => validateEnv(input),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('CLIENT_URL'));
        return true;
      }
    );
  });

  test('Empty CLIENT_URL triggers validation error', () => {
    assert.throws(
      () => validateEnv({ ...validBase, CLIENT_URL: '   ' }),
      (err) => {
        assert.ok(err.message.includes('CLIENT_URL'));
        return true;
      }
    );
  });

  test('Malformed CLIENT_URL (not a URL) triggers validation error', () => {
    assert.throws(
      () => validateEnv({ ...validBase, CLIENT_URL: 'not-a-valid-url' }),
      (err) => {
        assert.ok(err.message.includes('CLIENT_URL'));
        return true;
      }
    );
  });

  test('CLIENT_URL with unsupported protocol (e.g. ftp) triggers validation error', () => {
    assert.throws(
      () => validateEnv({ ...validBase, CLIENT_URL: 'ftp://localhost:5173' }),
      (err) => {
        assert.ok(err.message.includes('protocol'));
        return true;
      }
    );
  });

  test('Wildcard (*) CLIENT_URL is rejected for cookie credentials security', () => {
    assert.throws(
      () => validateEnv({ ...validBase, CLIENT_URL: '*' }),
      (err) => {
        assert.ok(err.message.includes('wildcard'));
        return true;
      }
    );
  });

  test('Invalid PORT (negative, out of bounds, or string) triggers validation error', () => {
    // Negative port
    assert.throws(() => validateEnv({ ...validBase, PORT: '-1' }));
    // Out of range port (> 65535)
    assert.throws(() => validateEnv({ ...validBase, PORT: '70000' }));
    // Non-numeric port
    assert.throws(() => validateEnv({ ...validBase, PORT: 'not-a-number' }));
  });

  test('Invalid NODE_ENV triggers validation error', () => {
    assert.throws(
      () => validateEnv({ ...validBase, NODE_ENV: 'staging' }),
      (err) => {
        assert.ok(err.message.includes('NODE_ENV'));
        return true;
      }
    );
  });

  test('Default PORT is applied when omitted', () => {
    const input = {
      ...validBase,
      NODE_ENV: 'production',
      CLIENT_URL: 'https://shopfinder.com'
    };
    delete input.PORT;
    const config = validateEnv(input);
    assert.equal(config.PORT, 4000);
    assert.equal(config.isProduction, true);
  });

  test('Missing POCKETBASE_URL triggers validation error', () => {
    const input = { ...validBase };
    delete input.POCKETBASE_URL;
    assert.throws(
      () => validateEnv(input),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('POCKETBASE_URL'));
        return true;
      }
    );
  });

  test('Malformed POCKETBASE_URL triggers validation error', () => {
    assert.throws(
      () => validateEnv({ ...validBase, POCKETBASE_URL: 'not-a-valid-url' }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('POCKETBASE_URL'));
        return true;
      }
    );
  });

  test('POCKETBASE_URL with unsupported protocol triggers validation error', () => {
    assert.throws(
      () => validateEnv({ ...validBase, POCKETBASE_URL: 'ftp://localhost:8090' }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('protocol'));
        return true;
      }
    );
  });

  test('Missing POCKETBASE_ADMIN_EMAIL triggers validation error', () => {
    const input = { ...validBase };
    delete input.POCKETBASE_ADMIN_EMAIL;
    assert.throws(
      () => validateEnv(input),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('POCKETBASE_ADMIN_EMAIL'));
        return true;
      }
    );
  });

  test('Invalid POCKETBASE_ADMIN_EMAIL triggers validation error', () => {
    assert.throws(
      () => validateEnv({ ...validBase, POCKETBASE_ADMIN_EMAIL: 'not-an-email' }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('POCKETBASE_ADMIN_EMAIL'));
        return true;
      }
    );
  });

  test('Missing POCKETBASE_ADMIN_PASSWORD triggers validation error', () => {
    const input = { ...validBase };
    delete input.POCKETBASE_ADMIN_PASSWORD;
    assert.throws(
      () => validateEnv(input),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('POCKETBASE_ADMIN_PASSWORD'));
        return true;
      }
    );
  });

  test('Empty POCKETBASE_ADMIN_PASSWORD triggers validation error', () => {
    assert.throws(
      () => validateEnv({ ...validBase, POCKETBASE_ADMIN_PASSWORD: '' }),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('POCKETBASE_ADMIN_PASSWORD'));
        return true;
      }
    );
  });

  test('dotenv loads server/.env correctly even when process is started from project root', async () => {
    // Run node from workspace root rather than server/ directory
    const script = `
      import('./server/src/config/env.js').then(({ env }) => {
        if (env.PORT === 4000 && env.NODE_ENV === 'development') {
          process.exit(0);
        } else {
          process.exit(2);
        }
      }).catch(() => process.exit(3));
    `;

    const exitCode = await new Promise((resolve) => {
      execFile('node', ['--input-type=module', '-e', script], { cwd: projectRoot }, (error) => {
        resolve(error ? (error.code ?? 1) : 0);
      });
    });

    assert.equal(exitCode, 0, 'env.js must successfully load server/.env when running from root');
  });

  test('Invalid environment configuration causes the server process to exit with non-zero exit code', async () => {
    // Spawn server with invalid CLIENT_URL override
    const serverEntry = path.resolve(serverDir, 'src/server.js');

    const exitCode = await new Promise((resolve) => {
      execFile(
        'node',
        [serverEntry],
        {
          cwd: serverDir,
          env: {
            ...process.env,
            CLIENT_URL: 'invalid-not-a-url'
          }
        },
        (error) => {
          resolve(error ? (error.code ?? 1) : 0);
        }
      );
    });

    assert.notEqual(exitCode, 0, 'Server process must exit with non-zero code on invalid configuration');
    assert.equal(exitCode, 1, 'Expected exit code 1 on unhandled validation throw');
  });
});
