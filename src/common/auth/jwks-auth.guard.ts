import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwksVerifierService } from '@common/auth/jwks-verifier.service';
import type { AuthedUser } from '@common/auth/authed-socket.type';

type RawRequest = {
  headers: { authorization?: string };
  user?: AuthedUser;
};

/** An HTTP request whose Bearer token has passed {@link JwksAuthGuard}. */
export type AuthedRequest = RawRequest & { user: AuthedUser };

/**
 * HTTP counterpart of the WS handshake auth: verifies the `Authorization:
 * Bearer <token>` access token against the backend JWKS and attaches the user
 * to `request.user`. Throws 401 on a missing or invalid token.
 */
@Injectable()
export class JwksAuthGuard implements CanActivate {
  constructor(private readonly verifier: JwksVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RawRequest>();
    const token = extractBearer(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }
    request.user = await this.verifier.verifyAccessToken(token);
    return true;
  }
}

function extractBearer(header: string | undefined): string | null {
  if (typeof header === 'string' && header.length > 0) {
    return header.replace(/^Bearer\s+/i, '');
  }
  return null;
}
