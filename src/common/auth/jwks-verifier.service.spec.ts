import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { generateKeyPairSync, createPublicKey } from 'crypto';
import { sign } from 'jsonwebtoken';
import type { ConfigService } from '@nestjs/config';
import { JwksVerifierService } from '@common/auth/jwks-verifier.service';

/**
 * Integration test for the auth bridge: a real RSA keypair, a real in-process
 * JWKS endpoint, and real RS256 verification — no mocking of jwks-rsa or
 * jsonwebtoken. This is the load-bearing security check for the whole service.
 */
describe('JwksVerifierService (integration)', () => {
  const kid = 'test-kid-1';
  const issuer = 'ledgerpro-backend';
  const audience = 'ledgerpro-api';

  let server: HttpServer;
  let jwksUri: string;
  let privateKey: string;
  let otherPrivateKey: string;

  function rsaPem(): { privateKey: string; publicKey: string } {
    return generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  }

  beforeAll(async () => {
    const pair = rsaPem();
    privateKey = pair.privateKey;
    otherPrivateKey = rsaPem().privateKey;

    const jwk = createPublicKey(pair.publicKey).export({
      format: 'jwk',
    }) as Record<string, string>;
    const doc = JSON.stringify({
      keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }],
    });

    server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(doc);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;
    jwksUri = `http://127.0.0.1:${port}/.well-known/jwks.json`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function makeVerifier(): JwksVerifierService {
    const config = {
      getOrThrow: () => jwksUri,
      get: (key: string, fallback?: string) =>
        key === 'JWT_ISSUER'
          ? issuer
          : key === 'JWT_AUDIENCE'
            ? audience
            : fallback,
    } as unknown as ConfigService;
    return new JwksVerifierService(config);
  }

  function makeToken(
    key: string,
    overrides: { audience?: string; sub?: string } = {},
  ): string {
    return sign(
      { email: 'manager@ledgerpro.io', role: 'MANAGER', branchId: 'branch-1' },
      key,
      {
        algorithm: 'RS256',
        keyid: kid,
        issuer,
        audience: overrides.audience ?? audience,
        subject: overrides.sub ?? 'user-1',
        expiresIn: '5m',
      },
    );
  }

  it('verifies a valid RS256 token and extracts claims', async () => {
    const user = await makeVerifier().verifyAccessToken(makeToken(privateKey));
    expect(user).toEqual({
      sub: 'user-1',
      email: 'manager@ledgerpro.io',
      role: 'MANAGER',
      branchId: 'branch-1',
    });
  });

  it('rejects a token with the wrong audience', async () => {
    const token = makeToken(privateKey, { audience: 'someone-else' });
    await expect(makeVerifier().verifyAccessToken(token)).rejects.toThrow();
  });

  it('rejects a token signed by an unknown key', async () => {
    const token = makeToken(otherPrivateKey);
    await expect(makeVerifier().verifyAccessToken(token)).rejects.toThrow();
  });

  it('rejects a malformed token', async () => {
    await expect(
      makeVerifier().verifyAccessToken('not-a-jwt'),
    ).rejects.toThrow();
  });
});
