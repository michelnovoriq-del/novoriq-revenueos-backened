"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptStripeKey = encryptStripeKey;
exports.decryptStripeKey = decryptStripeKey;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
function encryptStripeKey(text) {
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
        throw new Error("Critical: ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
    }
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
        encryptedStripeKey: `${encrypted}:${authTag}`,
        stripeKeyIv: iv.toString('hex')
    };
}
function decryptStripeKey(encryptedStripeKey, stripeKeyIv) {
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY)
        throw new Error("Missing Master Key");
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const [encryptedText, authTag] = encryptedStripeKey.split(':');
    const iv = Buffer.from(stripeKeyIv, 'hex');
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
