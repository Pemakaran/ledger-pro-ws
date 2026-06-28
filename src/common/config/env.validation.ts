import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Known environment variables. Every field is optional so local dev boots from
 * the in-code defaults, but any value that IS supplied must be well-formed — a
 * malformed PORT fails the boot instead of surfacing deep inside a handshake.
 * Production additionally requires the cross-service wiring (see below).
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(NodeEnv)
  NODE_ENV?: NodeEnv;

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  REALTIME_REDIS_CHANNEL?: string;

  @IsOptional()
  @IsString()
  JWKS_URI?: string;

  @IsOptional()
  @IsString()
  JWT_ISSUER?: string;

  @IsOptional()
  @IsString()
  JWT_AUDIENCE?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${detail}`);
  }

  // The realtime service is useless without the event bus and the JWKS source,
  // so production must wire both explicitly rather than fall back to a default.
  const isProd =
    (validated.NODE_ENV ?? NodeEnv.Development) === NodeEnv.Production;
  if (isProd) {
    if (!validated.REDIS_URL) {
      throw new Error('REDIS_URL must be set in production');
    }
    if (!validated.JWKS_URI) {
      throw new Error('JWKS_URI must be set in production');
    }
  }

  return validated;
}
