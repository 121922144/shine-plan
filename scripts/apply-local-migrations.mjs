import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))
const result = spawnSync(process.execPath, [
  wrangler,
  'd1', 'migrations', 'apply', 'bag-plan-db',
  '--local', '--config', 'wrangler.local.jsonc',
], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    CI: '1',
    WRANGLER_WRITE_LOGS: 'false',
    WRANGLER_LOG_PATH: resolve(root, '.wrangler/logs'),
  },
})

process.exit(result.status ?? 1)
