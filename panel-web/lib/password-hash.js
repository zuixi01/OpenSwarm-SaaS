const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

function hashPassword(plainText) {
  const input = String(plainText || '');
  if (!input) throw new Error('password is required');
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = crypto.scryptSync(input, salt, SCRYPT_KEYLEN).toString('base64');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(plainText, encoded) {
  const input = String(plainText || '');
  const value = String(encoded || '');
  if (!input || !value) return false;
  const parts = value.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = parts[1];
  const hashBase64 = parts[2];
  let expected;
  try {
    expected = Buffer.from(hashBase64, 'base64');
  } catch (_) {
    return false;
  }
  const actual = crypto.scryptSync(input, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  hashPassword,
  verifyPassword,
};

