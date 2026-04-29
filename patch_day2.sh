#!/bin/bash

echo "[🔧] Patching the encryption utility..."

cat << 'CODE' > src/utils/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptStripeKey(text: string) {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error("Critical: ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }

  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedStripeKey: `${encrypted}:${authTag}`,
    stripeKeyIv: iv.toString('hex')
  };
}

export function decryptStripeKey(encryptedStripeKey: string, stripeKeyIv: string) {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) throw new Error("Missing Master Key");

  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const [encryptedText, authTag] = encryptedStripeKey.split(':');
  const iv = Buffer.from(stripeKeyIv, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
CODE

echo "[✅] Patch applied. Running verification test..."
npx ts-node src/test_encryption.ts
