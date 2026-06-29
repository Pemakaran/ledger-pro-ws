import { z } from 'zod';

/**
 * Known environment variables, validated once at boot. Every field is optional
 * so local dev boots from the in-code defaults, but any value that IS supplied
 * must be well-formed — a malformed PORT fails the boot instead of surfacing
 * deep inside a handshake. Zod is the single source of truth; the static `Env`
 * type is derived via `z.infer` (no parallel hand-written interface).
 */
export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS).optional(),
  PORT: z.string().regex(/^\d+$/, 'PORT must be a number').optional(),
  CORS_ORIGIN: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REALTIME_REDIS_CHANNEL: z.string().optional(),
  JWKS_URI: z.string().optional(),
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * ConfigModule `validate` hook. Returns the parsed config or throws with a
 * single readable message listing every problem. The realtime service is
 * useless without the event bus and the JWKS source, so production must wire
 * both explicitly rather than fall back to a dev default.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const detail = result.error.issues.map((i) => i.message).join('; ');
    throw new Error(`Invalid environment configuration: ${detail}`);
  }

  const env = result.data;
  if ((env.NODE_ENV ?? 'development') === 'production') {
    for (const key of ['REDIS_URL', 'JWKS_URI'] as const) {
      if (!env[key]) {
        throw new Error(
          `Invalid environment configuration: ${key} must be set in production`,
        );
      }
    }
  }

  return env;
}
