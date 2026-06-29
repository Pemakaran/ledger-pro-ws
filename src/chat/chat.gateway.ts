import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace } from 'socket.io';
import { JwksVerifierService } from '@common/auth/jwks-verifier.service';
import { createWsAuthMiddleware } from '@common/auth/ws-auth.middleware';
import type { AuthedSocket } from '@common/auth/authed-socket.type';
import { ChatService } from '@chat/chat.service';
import {
  chatEditPayloadSchema,
  chatMessagePayloadSchema,
  conversationRefSchema,
  messageRefSchema,
} from '@chat/schema';

const roomFor = (conversationId: string): string =>
  `conversation:${conversationId}`;

/**
 * The `/chat` namespace. Handshakes are JWKS-authenticated by the same
 * middleware the notifications gateway uses; every event re-checks participant
 * membership through ChatService before touching a conversation room. Messages
 * are persisted, then fanned out to `conversation:<id>` (Redis adapter delivers
 * across replicas).
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server!: Namespace;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly verifier: JwksVerifierService,
    private readonly chat: ChatService,
  ) {}

  afterInit(): void {
    this.server.use(createWsAuthMiddleware(this.verifier));
    this.logger.log('Chat namespace initialized (JWKS-authenticated)');
  }

  handleConnection(client: AuthedSocket): void {
    void client.join(`user:${client.data.user.sub}`);
  }

  @SubscribeMessage('chat:join')
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: unknown,
  ): Promise<{ ok: true }> {
    const { conversationId } = conversationRefSchema.parse(data);
    await this.chat.assertParticipant(conversationId, client.data.user.sub);
    await client.join(roomFor(conversationId));
    return { ok: true };
  }

  @SubscribeMessage('chat:message')
  async onMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: unknown,
  ): Promise<{ ok: true; id: string }> {
    const { conversationId, body, attachments } =
      chatMessagePayloadSchema.parse(data);
    const message = await this.chat.postMessage(
      client.data.user.sub,
      conversationId,
      body,
      attachments ?? [],
    );
    this.server.to(roomFor(conversationId)).emit('chat:message', message);
    return { ok: true, id: message.id };
  }

  @SubscribeMessage('chat:typing')
  async onTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: unknown,
  ): Promise<void> {
    const { conversationId } = conversationRefSchema.parse(data);
    await this.chat.assertParticipant(conversationId, client.data.user.sub);
    client
      .to(roomFor(conversationId))
      .emit('chat:typing', { conversationId, userId: client.data.user.sub });
  }

  @SubscribeMessage('chat:read')
  async onRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: unknown,
  ): Promise<void> {
    const { conversationId } = conversationRefSchema.parse(data);
    const lastReadAt = await this.chat.markRead(
      client.data.user.sub,
      conversationId,
    );
    client.to(roomFor(conversationId)).emit('chat:read', {
      conversationId,
      userId: client.data.user.sub,
      lastReadAt: lastReadAt.toISOString(),
    });
  }

  @SubscribeMessage('chat:edit')
  async onEdit(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: unknown,
  ): Promise<{ ok: true }> {
    const { messageId, body } = chatEditPayloadSchema.parse(data);
    const message = await this.chat.editMessage(
      client.data.user.sub,
      messageId,
      body,
    );
    this.server
      .to(roomFor(message.conversationId))
      .emit('chat:message-updated', message);
    return { ok: true };
  }

  @SubscribeMessage('chat:delete')
  async onDelete(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: unknown,
  ): Promise<{ ok: true }> {
    const { messageId } = messageRefSchema.parse(data);
    const message = await this.chat.deleteMessage(
      client.data.user.sub,
      messageId,
    );
    this.server
      .to(roomFor(message.conversationId))
      .emit('chat:message-deleted', message);
    return { ok: true };
  }

  /**
   * Eject a user from a group's chat (called by the control consumer after the
   * backend revokes membership): drop their live sockets from the conversation
   * room (/chat) and the group room (/notifications), then signal their client
   * to tear down. The participant row is pruned separately, so a reconnect or a
   * replay also fails the membership gate.
   */
  revoke(userId: string, conversationId: string, groupId: string): void {
    const userRoom = `user:${userId}`;
    const notifications = this.server.server.of('/notifications');
    this.server.in(userRoom).socketsLeave(roomFor(conversationId));
    notifications.in(userRoom).socketsLeave(`group:${groupId}`);
    this.server.to(userRoom).emit('chat:revoked', { conversationId, groupId });
    notifications.to(userRoom).emit('group:revoked', { groupId });
  }
}
