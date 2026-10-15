#!/usr/bin/env node
/**
 * Generate a new VAPID P-256 keypair for Web Push.
 *
 * Run locally: node scripts/generate-vapid-keys.mjs
 *
 * Add output to Vercel Project Settings -> Environment Variables
 * (Preview first, then Production when ready).
 *
 * NEVER paste the private key into chat, screenshots, source code or git.
 * Generating again creates a different identity; existing push subscriptions
 * must be re-created after rotating keys.
 */
import { generateKeyPairSync } from 'node:crypto'

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const { x, y, d } = privateKey.export({ format: 'jwk' })

if (!x || !y || !d) throw new Error('生成的 VAPID P-256 密钥不完整')

const publicKey = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(x, 'base64url'),
  Buffer.from(y, 'base64url'),
]).toString('base64url')

if (Buffer.from(publicKey, 'base64url').length !== 65 || Buffer.from(d, 'base64url').length !== 32) {
  throw new Error('生成的 VAPID 密钥长度不正确')
}

console.log('VAPID_PUBLIC_KEY=' + publicKey)
console.log('VAPID_PRIVATE_KEY=' + d)
console.log('VAPID_SUBJECT=mailto:你的邮箱@example.com')
console.log('\n安全提示：仅复制上述值到 Vercel 的服务器端环境变量。')
console.log('将 VAPID_SUBJECT 换成你自己的有效邮箱地址。')
console.log('不要使用 VITE_ 前缀，也不要将密钥提交到 GitHub 或发送到聊天中。')
