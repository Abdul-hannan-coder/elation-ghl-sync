import crypto from 'node:crypto';
import { config } from './config.js';

export function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', config.elation.webhookSecret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  let b;
  try {
    b = Buffer.from(signatureHeader, 'hex');
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
