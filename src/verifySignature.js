import crypto from 'node:crypto';
import { config } from './config.js';

// Ed25519 SPKI DER prefix: wraps a 32-byte raw public key into a parseable DER structure
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function loadPubKey(base64) {
  const raw = Buffer.from(base64, 'base64');
  if (raw.length !== 32) {
    throw new Error(`Invalid Ed25519 public key length: ${raw.length}`);
  }
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

const keys = (config.elation.signingPubKeys || [])
  .filter(Boolean)
  .map(loadPubKey);

function decodeSig(sigHeader) {
  // Try base64 first (Elation default), then hex
  try {
    const b = Buffer.from(sigHeader, 'base64');
    if (b.length === 64) return b;
  } catch {}
  try {
    const b = Buffer.from(sigHeader, 'hex');
    if (b.length === 64) return b;
  } catch {}
  return null;
}

export function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || keys.length === 0) return false;
  const sig = decodeSig(signatureHeader);
  if (!sig) return false;
  return keys.some((key) => {
    try {
      return crypto.verify(null, rawBody, key, sig);
    } catch {
      return false;
    }
  });
}
