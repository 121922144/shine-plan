/**
 * Vercel / Neon PostgreSQL access via Neon's SQL-over-HTTP endpoint.
 *
 * The connection string is read on the server only. No DB credentials are
 * embedded in the client bundle, and each parameter is sent separately from
 * the SQL statement ($1, $2...) to prevent SQL injection.
 *
 * Using the documented HTTP protocol keeps the existing npm lockfile intact.
 */
export type QueryResult<T> = { rows: T[]; rowCount: number }

type NeonField = { name: string; dataTypeID: number }
type NeonResponse = {
  rows?: Record<string, unknown>[]
  rowCount?: number
  fields?: NeonField[]
  message?: string
  error?: string
}

function dbConnection() {
  const connection = process.env.DATABASE_URL
  if (!connection) throw new Error('DATABASE_URL 未配置：请在 Vercel 连接 Neon 数据库')
  const url = new URL(connection)
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname.endsWith('.neon.tech')) {
    throw new Error('DATABASE_URL 必须使用 Neon PostgreSQL 连接地址')
  }
  // Neon replaces the database endpoint's first DNS label with "api".
  const endpoint = `https://${url.hostname.replace(/^[^.]+/, 'api')}/sql`
  return { connection, endpoint }
}

function decodeValue(value: unknown, oid: number): unknown {
  if (value === null || value === undefined) return value
  switch (oid) {
    case 16: // bool
      return value === true || value === 't' || value === 'true'
    case 20: { // bigint; preserve values outside JavaScript's safe integer range
      const number = Number(value)
      return Number.isSafeInteger(number) ? number : String(value)
    }
    case 21: // smallint
    case 23: // integer
    case 700: // real
    case 701: // double precision
      return Number(value)
    case 114: // json
    case 3802: // jsonb
      return typeof value === 'string' ? JSON.parse(value) : value
    default:
      return value
  }
}

export async function dbQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const { connection, endpoint } = dbConnection()
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Neon-Connection-String': connection,
      'Neon-Raw-Text-Output': 'true',
    },
    body: JSON.stringify({ query, params }),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null) as NeonResponse | null
  if (!response.ok) {
    // Do not echo connection strings or SQL parameters in error messages.
    throw new Error(`Neon SQL 请求失败（HTTP ${response.status}）：${data?.message || data?.error || '请检查建表及连接配置'}`)
  }
  if (!data || !Array.isArray(data.rows)) throw new Error('Neon SQL 返回的数据格式不正确')

  const types = new Map((data.fields || []).map(({ name, dataTypeID }) => [name, dataTypeID]))
  const rows = data.rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, decodeValue(value, types.get(key) || 0)]),
  )) as T[]
  return { rows, rowCount: Number(data.rowCount || 0) }
}

/** Secrets are only available in server-side Vercel Functions. */
export function getRuntimeEnv() {
  return process.env
}
