import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const required = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_R2_BUCKET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing deployment variables: ${missing.join(', ')}`);
}

const customDomain = process.env.CLOUDFLARE_CUSTOM_DOMAIN?.trim();
const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET?.trim();
const production = process.env.DEPLOYMENT_ENVIRONMENT === 'production';

if (production && !customDomain) {
  throw new Error('Production deployment requires CLOUDFLARE_CUSTOM_DOMAIN.');
}

const generatedConfigPath = resolve('dist/server/wrangler.json');
const config = {
  ...JSON.parse(readFileSync(generatedConfigPath, 'utf8')),
  $schema: '../../node_modules/wrangler/config-schema.json',
  name: production ? 'c-and-assess' : 'c-and-assess-staging',
  account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
  main: 'index.js',
  workers_dev: !production,
  observability: { enabled: true },
  assets: { directory: '../client', binding: 'ASSETS' },
  d1_databases: [
    {
      binding: 'DB',
      database_name: process.env.CLOUDFLARE_D1_DATABASE_NAME || 'caciitg-assess-production',
      database_id: process.env.CLOUDFLARE_D1_DATABASE_ID,
      migrations_dir: '../../drizzle',
    },
  ],
  r2_buckets: [{ binding: 'FILES', bucket_name: r2Bucket }],
  ...(customDomain
    ? { routes: [{ pattern: customDomain, custom_domain: true }] }
    : {}),
};

delete config.dev;
delete config.build;
delete config.topLevelName;

const outputPath = resolve('dist/server/wrangler.deploy.jsonc');
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(outputPath);

