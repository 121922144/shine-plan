// Plain UI development runs without Miniflare. Cloud-backed API calls will
// return their existing "database unavailable" response through getD1().
export const env: { DB?: D1Database } = {}
