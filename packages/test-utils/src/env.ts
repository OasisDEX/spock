import { join } from 'path'

export async function withScopedEnv<T>(envDir: string, fn: () => Promise<T> | T): Promise<T> {
  const backupEnv = { ...process.env }

  const chainHost = process.env['VL_CHAIN_HOST']
  const localEnvPath = join(envDir, '.env.local')
  require('dotenv').config({ path: localEnvPath })
  const envPath = join(envDir, '.env')
  require('dotenv').config({ path: envPath })
  // prefer chainHost definition from the external environment
  process.env['VL_CHAIN_HOST'] = chainHost || process.env['VL_CHAIN_HOST']

  const r = await fn()

  process.env = backupEnv

  return r
}
