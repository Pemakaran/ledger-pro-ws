import { validateEnv } from '@common/config/env.validation';

describe('validateEnv', () => {
  it('accepts a minimal dev config', () => {
    const cfg = validateEnv({ NODE_ENV: 'development', PORT: '3001' });
    expect(cfg.PORT).toBe('3001');
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('requires REDIS_URL and JWKS_URI in production', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', REDIS_URL: 'redis://r:6379' }),
    ).toThrow(/JWKS_URI/);
  });
});
