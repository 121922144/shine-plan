import { sites } from '@openai/sites-vite-plugin'
import vinext from 'vinext'
import { fileURLToPath } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import hostingConfig from './.openai/hosting.json'

const PLACEHOLDER_DATABASE_ID = '00000000-0000-4000-8000-000000000000'
const { d1 } = hostingConfig

export default defineConfig(async ({ command, mode }) => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false'
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs'
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry'

  const isVercelBuild = mode === 'vercel'
  const plugins: PluginOption[] = [vinext()]
  if (isVercelBuild) {
    const { nitro } = await import('nitro/vite')
    plugins.push(...nitro({ preset: 'vercel' }))
  } else {
    plugins.push(sites())
  }

  const useCloudflareRuntime = !isVercelBuild && (command === 'build' || mode === 'cloudflare')
  if (useCloudflareRuntime) {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      config: {
        main: 'vinext/server/fetch-handler',
        compatibility_flags: ['nodejs_compat'],
        d1_databases: d1 ? [{ binding: d1, database_name: 'bag-plan-db', database_id: PLACEHOLDER_DATABASE_ID }] : [],
      },
    }))
  }

  return {
    plugins,
    resolve: useCloudflareRuntime ? undefined : {
      alias: {
        'cloudflare:workers': fileURLToPath(new URL('./db/cloudflare-workers.dev.ts', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  }
})
