import { ForbiddenException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace } from 'socket.io';
import { JwksVerifierService } from '@common/auth/jwks-verifier.service';
import { GroupMembershipVerifier } from '@common/membership/group-membership.verifier';
import { createWsAuthMiddleware } from '@common/auth/ws-auth.middleware';
import type { AuthedSocket } from '@common/auth/authed-socket.type';
import { groupRoomSchema, type RealtimeNamespace } from '@common/schema';

/**
 * The `/notifications` namespace: per-user notifications + system-alert
 * broadcasts. Every handshake is JWKS-authenticated, then the socket joins the
 * rooms the backend targets. The old in-backend gateway never joined any room,
 * so `server.to(userId)` matched nothing — this is the fix.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Namespace;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly verifier: JwksVerifierService,
    private readonly membership: GroupMembershipVerifier,
  ) {}

  afterInit(): void {
    // Authenticate every handshake on this namespace before a socket connects.
    this.server.use(createWsAuthMiddleware(this.verifier));
    this.logger.log('Notifications namespace initialized (JWKS-authenticated)');
  }

  handleConnection(client: AuthedSocket): void {
    const { sub, role, branchId } = client.data.user;
    void client.join(`user:${sub}`);
    void client.join(`role:${role}`);
    if (branchId) {
      void client.join(`branch:${branchId}`);
    }
    this.logger.debug(
      `Connected ${client.id} → user:${sub} role:${role} branch:${branchId ?? '—'}`,
    );
  }

  handleDisconnect(client: AuthedSocket): void {
    this.logger.debug(
      `Disconnected ${client.id} (user:${client.data.user?.sub ?? '?'})`,
    );
  }

  /**
   * Join a customer-group's live room so the backend's `group-cart:changed`
   * broadcast (targeted at `group:<id>`) actually reaches this socket — nothing
   * joined that room before, so group cart-sync delivered to no one. Membership
   * is re-checked against the backend on every join.
   */
  @SubscribeMessage('group:join')
  async onGroupJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: unknown,
  ): Promise<{ ok: true }> {
    const { groupId } = groupRoomSchema.parse(data);
    const isMember = await this.membership.verify(groupId, client.data.token);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this group');
    }
    await client.join(`group:${groupId}`);
    return { ok: true };
  }

  @SubscribeMessage('group:leave')
  async onGroupLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: unknown,
  ): Promise<{ ok: true }> {
    const { groupId } = groupRoomSchema.parse(data);
    await client.leave(`group:${groupId}`);
    return { ok: true };
  }

  /**
   * Resolve a socket.io namespace by name so the Redis subscriber can fan out
   * to it. Reaches the root server via the gateway's own namespace; returns
   * null until the websocket server is initialized.
   */
  namespaceFor(name: RealtimeNamespace): Namespace | null {
    if (!this.server) {
      return null;
    }
    return this.server.server.of(name);
  }
}
