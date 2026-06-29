import { Logger } from '@nestjs/common';
import type { Namespace, Socket } from 'socket.io';
import type { JwksVerifierService } from '@common/auth/jwks-verifier.service';
import type { AuthedSocket } from '@common/auth/authed-socket.type';

// The exact middleware signature socket.io expects on a namespace `.use(...)`.
type WsMiddleware = Parameters<Namespace['use']>[0];

const logger = new Logger('WsAuth');

/**
 * socket.io namespace middleware that authenticates the handshake. Reads the
 * access token from `handshake.auth.token` (preferred) or the Authorization
 * header, verifies it against the backend JWKS, and stashes the user + the raw
 * token on `socket.data` (the token is reused for backend membership checks on
 * room joins). A rejected handshake never reaches a gateway — the client
 * receives a `connect_error`.
 */
export function createWsAuthMiddleware(
  verifier: JwksVerifierService,
): WsMiddleware {
  return (socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error('Unauthorized: missing access token'));
      return;
    }

    verifier
      .verifyAccessToken(token)
      .then((user) => {
        const authed = socket as AuthedSocket;
        authed.data.user = user;
        authed.data.token = token;
        next();
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unauthorized';
        logger.debug(`Rejected socket ${socket.id}: ${message}`);
        next(new Error(message));
      });
  };
}

function extractToken(socket: Socket): string | null {
  const raw: unknown = socket.handshake.auth?.token;
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/^Bearer\s+/i, '');
  }
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.length > 0) {
    return header.replace(/^Bearer\s+/i, '');
  }
  return null;
}
