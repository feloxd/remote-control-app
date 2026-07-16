function requireSetting(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Copy .env.example to .env and provide a secure value.`);
  }
  return value;
}

function parseHttpUrl(name, required = false) {
  const value = required ? requireSetting(name) : process.env[name]?.trim();
  if (!value) return '';
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must use http:// or https://`);
  }
  return parsed.toString();
}

const jwtSecret = requireSetting('JWT_SECRET');
if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET must contain at least 32 bytes');
}

const corsOrigins = requireSetting('CORS_ORIGINS')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

module.exports = Object.freeze({
  operatorUsername: requireSetting('OPERATOR_USERNAME'),
  operatorPasswordHash: requireSetting('OPERATOR_PASSWORD_HASH'),
  jwtSecret,
  corsOrigins,
  sourceCodeUrl: parseHttpUrl('SOURCE_CODE_URL'),
});
