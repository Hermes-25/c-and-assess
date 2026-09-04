import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/render_wrangler_config.mjs');
const fixture = mkdtempSync(join(tmpdir(), 'assess-config-test-'));
try {
  mkdirSync(join(fixture, 'dist/server'), { recursive: true });
  writeFileSync(join(fixture, 'dist/server/wrangler.json'), JSON.stringify({
    no_bundle: true,
    rules: [{ type: 'ESModule', globs: ['**/*.js'] }],
    r2_buckets: [{ binding: 'FILES', bucket_name: 'must-not-leak' }],
    routes: [{ pattern: 'must-not-leak.example', custom_domain: true }],
  }));
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'test-account', CLOUDFLARE_D1_DATABASE_ID: 'test-db' };
  for (const key of ['CLOUDFLARE_R2_BUCKET', 'CLOUDFLARE_CUSTOM_DOMAIN', 'CLOUDFLARE_D1_DATABASE_NAME', 'DEPLOYMENT_ENVIRONMENT']) delete env[key];
  function run(extra = {}) {
    const result = spawnSync(process.execPath, [script], { cwd: fixture, env: { ...env, ...extra }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(readFileSync(join(fixture, 'dist/server/wrangler.deploy.jsonc'), 'utf8'));
  }
  const free = run();
  assert.deepEqual(free.r2_buckets, []);
  assert.deepEqual(free.routes, []);
  assert.equal(free.d1_databases[0].database_name, 'caciitg-assess-staging');
  assert.equal(free.no_bundle, true);
  assert.equal(free.workers_dev, true);
  const upgraded = run({ CLOUDFLARE_R2_BUCKET: 'approved-private-bucket' });
  assert.deepEqual(upgraded.r2_buckets, [{ binding: 'FILES', bucket_name: 'approved-private-bucket' }]);
  const production = run({ DEPLOYMENT_ENVIRONMENT: 'production', CLOUDFLARE_CUSTOM_DOMAIN: 'assess.example.org' });
  assert.deepEqual(production.r2_buckets, []);
  assert.equal(production.workers_dev, false);
  const rejected = spawnSync(process.execPath, [script], { cwd: fixture, env: { ...env, DEPLOYMENT_ENVIRONMENT: 'production' }, encoding: 'utf8' });
  assert.notEqual(rejected.status, 0);
  console.log('Deployment configuration: free, upgraded, and production safety checks passed.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
