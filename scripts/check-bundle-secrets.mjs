#!/usr/bin/env node
/**
 * After `next build`, verify that no server secret reached the client bundle.
 * Fails if the service-role key value (when set) or the variable name appears
 * in .next/static, or if any JWT with role "service_role" is embedded.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = '.next/static';
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hits = [];

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css|html|json)$/.test(f)) {
      const s = readFileSync(p, 'utf8');
      if (s.includes('SUPABASE_SERVICE_ROLE_KEY')) hits.push(`${p}: variable name`);
      if (secret && s.includes(secret)) hits.push(`${p}: service-role key VALUE`);
      for (const m of s.matchAll(/eyJ[\w-]+\.(eyJ[\w-]+)\.[\w-]+/g)) {
        try {
          const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString());
          if (payload.role === 'service_role') hits.push(`${p}: service_role JWT`);
        } catch {}
      }
    }
  }
}

walk(root);
if (hits.length) {
  console.error('✗ Secrets found in client bundle:\n' + hits.join('\n'));
  process.exit(1);
}
console.log(`✓ No server secrets in ${root}`);
