import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Phase 6, Task 6.6 — Property Forms & Image Management Runner', () => {
  test('Executes client/src/tests/property-forms.test.jsx test suite cleanly', () => {
    // Clear NODE_TEST_* env vars so child process node --test doesn't skip execution
    const cleanEnv = { ...process.env };
    for (const key of Object.keys(cleanEnv)) {
      if (key.startsWith('NODE_TEST')) {
        delete cleanEnv[key];
      }
    }

    const result = spawnSync(
      process.execPath,
      ['--import', './client/src/tests/register.mjs', '--test', 'client/src/tests/property-forms.test.jsx'],
      {
        cwd: rootDir,
        env: cleanEnv,
        encoding: 'utf8',
      }
    );

    if (result.status !== 0) {
      console.error('STDOUT:', result.stdout);
      console.error('STDERR:', result.stderr);
    }

    assert.equal(result.status, 0, 'Property forms frontend test suite must pass');
    assert.ok(result.stdout.includes('pass 28'), 'All 28 frontend tests must pass');
  });
});

