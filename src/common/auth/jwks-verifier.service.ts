import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwksRsa from 'jwks-rsa';
import { verify, type JwtHeader, type VerifyOptions } from 'jsonwebtoken';
import type { AuthedUser } from '@common/auth/authed-socket.type';

interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string;
  branchId?: string | null;
}

/**
 * Verifies RS256 access tokens issued by the LedgerPro backend against its
 * public JWKS endpoint — no shared signing secret. Keys are cached, so steady
 * state needs no network round-trip per handshake.
 */
@Injectable()
export class JwksVerifierService {
  private readonly logger = new Logger(JwksVerifierService.name);
  private readonly jwks: ReturnType<typeof jwksRsa>;
  private readonly options: VerifyOptions;

  constructor(config: ConfigService) {
    this.jwks = jwksRsa({
      jwksUri: config.getOrThrow<string>('JWKS_URI'),
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    this.options = {
      algorithms: ['RS256'],
      issuer: config.get<string>('JWT_ISSUER', 'ledgerpro-backend'),
      audience: config.get<string>('JWT_AUDIENCE', 'ledgerpro-api'),
    };
  }

  /** Verify a token and return its user claims. Throws Unauthorized on failure. */
  async verifyAccessToken(token: string): Promise<AuthedUser> {
    const claims = await new Promise<AccessTokenClaims>((resolve, reject) => {
      verify(
        token,
        (header, callback) => this.resolveSigningKey(header, callback),
        this.options,
        (err, decoded) => {
          if (err || !decoded || typeof decoded === 'string') {
            reject(err ?? new Error('Malformed token payload'));
            return;
          }
          resolve(decoded as AccessTokenClaims);
        },
      );
    }).catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Token verification failed';
      throw new UnauthorizedException(message);
    });

    return {
      sub: claims.sub,
      email: claims.email,
      role: claims.role,
      branchId: claims.branchId ?? null,
    };
  }

  private resolveSigningKey(
    header: JwtHeader,
    callback: (err: Error | null, key?: string) => void,
  ): void {
    this.jwks
      .getSigningKey(header.kid)
      .then((key) => callback(null, key.getPublicKey()))
      .catch((err: unknown) => {
        this.logger.warn(
          `JWKS lookup failed for kid=${header.kid ?? 'none'}: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
        callback(err instanceof Error ? err : new Error('JWKS lookup failed'));
      });
  }
}
