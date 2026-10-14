/**
 * Normalize a contact URI for Web Push VAPID.
 *
 * Vercel's environment variable editor stores exactly what was entered.
 * An ordinary email (without "mailto:") is a common input mistake, and
 * Apple APNs rejects that value as BadJwtToken.
 *
 * Never log or expose the raw contact address, or any signing key.
 */
const validEmail = /^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/

export type SubjectValidation = {
  value: string | null
  issue: 'OK' | 'MISSING' | 'INVALID_SUBJECT_FORMAT'
  normalized: boolean
  normalization: 'NONE' | 'ADDED_MAILTO' | 'CLEANED_FORMAT'
}

export function validateVapidSubject(input: string | undefined): SubjectValidation {
  const original = input || ''
  let subject = original.trim()

  if (!subject) {
    return { value: null, issue: 'MISSING', normalized: false, normalization: 'NONE' }
  }

  // Permit surrounding quotes mistakenly copied into a dashboard value.
  if ((subject.startsWith('"') && subject.endsWith('"')) ||
      (subject.startsWith("'") && subject.endsWith("'"))) {
    subject = subject.slice(1, -1).trim()
  }

  // Accept a full-width colon and case variation in the mailto prefix.
  subject = subject.replace(/^mailto[:：]/i, 'mailto:')

  let normalization: SubjectValidation['normalization'] = 'NONE'
  if (validEmail.test(subject)) {
    subject = `mailto:${subject}`
    normalization = 'ADDED_MAILTO'
  } else if (subject !== original) {
    normalization = 'CLEANED_FORMAT'
  }

  const mailtoValid = subject.startsWith('mailto:') && validEmail.test(subject.slice('mailto:'.length))
  let httpsValid = false
  if (subject.startsWith('https://') && !/[\s<>"']/.test(subject)) {
    try {
      const url = new URL(subject)
      httpsValid = url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
    } catch { /* Invalid URL. */ }
  }
  if (!mailtoValid && !httpsValid) {
    return { value: null, issue: 'INVALID_SUBJECT_FORMAT', normalized: false, normalization: 'NONE' }
  }
  return {
    value: subject,
    issue: 'OK',
    normalized: subject !== original,
    normalization: subject === original ? 'NONE' : normalization === 'ADDED_MAILTO' ? 'ADDED_MAILTO' : 'CLEANED_FORMAT',
  }
}

export function getVapidSubject(input: string | undefined): string {
  const result = validateVapidSubject(input)
  if (!result.value) throw new Error('VAPID_SUBJECT 必须为有效的 mailto: 邮箱或 HTTPS 地址')
  return result.value
}
