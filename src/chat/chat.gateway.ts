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
import { chatMessagePayloadSchema, conversationRefSchema } from '@chat/schema';

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
    const { conversationId, body } = chatMessagePayloadSchema.parse(data);
    const message = await this.chat.postMessage(
      client.data.user.sub,
      conversationId,
      body,
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
    await this.chat.markRead(client.data.user.sub, conversationId);
    client
      .to(roomFor(conversationId))
      .emit('chat:read', { conversationId, userId: client.data.user.sub });
  }
}
