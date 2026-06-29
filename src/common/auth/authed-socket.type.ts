import type { Socket } from 'socket.io';

/** Claims lifted from a verified RS256 access token (mirrors the backend). */
export interface AuthedUser {
  sub: string;
  email: string;
  role: string;
  branchId: string | null;
}

/**
 * A socket whose handshake has passed the JWKS auth middleware: the verified
 * user plus the raw access token (reused for backend membership checks).
 */
export type AuthedSocket = Socket & {
  data: { user: AuthedUser; token: string };
};
