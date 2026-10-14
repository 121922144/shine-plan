import { getRuntimeEnv } from '@/db'
import { json } from '@/lib/server/device'
import { validateVapidSubject } from '@/lib/server/vapid'

function fromBase64Url(input: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) throw new Error('Invalid base64url characters')
  const padded = input.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - input.length % 4) % 4)
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

function toBase64Url(input: Uint8Array) {
  return btoa(String.fromCharCode(...input)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

type VapidDiagnostics = {
  publicKeyFormat: boolean
  privateKeyFormat: boolean
  subjectFormat: boolean
  keyPairMatches: boolean
  signatureVerified: boolean
}

/**
 * Web Push self-test. Do not return private keys, endpoints, token bodies,
 * signatures, or the subject address. Only expose validation booleans.
 */
async function diagnoseVapid(publicKey: string, privateKey: string, subject: string): Promise<VapidDiagnostics> {
  const result: VapidDiagnostics = {
    publicKeyFormat: false,
    privateKeyFormat: false,
    subjectFormat: false,
    keyPairMatches: false,
    signatureVerified: false,
  }

  // Check the *effective* subject sent to Apple, after safe normalization.
  result.subjectFormat = validateVapidSubject(subject).issue === 'OK'

  let publicBytes: Uint8Array
  let privateBytes: Uint8Array
  try {
    publicBytes = fromBase64Url(publicKey)
    result.publicKeyFormat = publicBytes.length === 65 && publicBytes[0] === 4
    privateBytes = fromBase64Url(privateKey)
    result.privateKeyFormat = privateBytes.length === 32
  } catch {
    return result
  }
  if (!result.publicKeyFormat || !result.privateKeyFormat) return result

  try {
    const x = toBase64Url(publicBytes.slice(1, 33))
    const y = toBase64Url(publicBytes.slice(33, 65))
    const d = toBase64Url(privateBytes)
    const algorithm: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const publicCryptoKey = await crypto.subtle.importKey('raw', publicBytes as Uint8Array<ArrayBuffer>, algorithm, false, ['verify'])
    const privateCryptoKey = await crypto.subtle.importKey('jwk',
      { kty: 'EC', crv: 'P-256', x, y, d, ext: false, key_ops: ['sign'] },
      algorithm, false, ['sign'],
    )
    result.keyPairMatches = true // Keys can be imported together.
    const payload = new TextEncoder().encode('Shine Plan VAPID configuration self-check')
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateCryptoKey, payload)
    result.signatureVerified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicCryptoKey, signature, payload)
    result.keyPairMatches = result.signatureVerified
  } catch {
    result.keyPairMatches = false
    result.signatureVerified = false
  }
  return result
}

export async function GET(request: Request) {
  const env = getRuntimeEnv()
  const vapidPublicKey = env.VAPID_PUBLIC_KEY || ''
  const subjectValidation = validateVapidSubject(env.VAPID_SUBJECT)
  const configured = Boolean(vapidPublicKey && env.VAPID_PRIVATE_KEY && subjectValidation.value)
  const data: Record<string, unknown> = {
    pushAvailable: configured,
    vapidPublicKey,
  }

  // On-demand, safe status-only diagnostics. Keep all private material server-side.
  if (new URL(request.url).searchParams.get('diagnose') === '1') {
    data.diagnostics = await diagnoseVapid(
      vapidPublicKey,
      env.VAPID_PRIVATE_KEY || '',
      env.VAPID_SUBJECT || '',
    )
    data.subjectIssue = subjectValidation.issue
    data.subjectNormalized = subjectValidation.normalized
    data.subjectNormalization = subjectValidation.normalization
    data.deployment = {
      environment: env.VERCEL_ENV || 'unknown',
      branch: env.VERCEL_GIT_COMMIT_REF || 'unknown',
      commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown',
    }
    data.serverTimeUtc = new Date().toISOString()
  }
  return json(data)
}
