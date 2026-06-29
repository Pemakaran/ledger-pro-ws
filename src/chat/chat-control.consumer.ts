import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@common/redis/redis.constants';
import {
  CHAT_CONTROL_CHANNEL,
  chatControlSchema,
  type ChatControlMessage,
} from '@common/schema';
import { ChatRepository } from '@chat/chat.repository';
import { ChatGateway } from '@chat/chat.gateway';

/**
 * Consumes the backend's chat-control channel and enforces group-membership
 * revocation inside the chat domain: prune the participant row(s) so re-join /
 * post fails the membership gate, then kick the user's live sockets out of the
 * chat + group rooms. It lives in the chat module (native ChatRepository +
 * ChatGateway access) and on its own Redis channel, so the generic realtime
 * relay stays a dumb passthrough and never sees control traffic.
 *
 * Idempotent by construction (DELETE / socketsLeave / emit are all no-ops on
 * repeat), so Redis at-least-once delivery is safe.
 */
@Injectable()
export class ChatControlConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatControlConsumer.name);
  private sub?: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly repo: ChatRepository,
    private readonly gateway: ChatGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    // A connection in subscribe mode can't run other commands, so duplicate.
    this.sub = this.redis.duplicate();
    await this.sub.subscribe(CHAT_CONTROL_CHANNEL);
    this.sub.on('message', (_channel, raw) => {
      void this.handle(raw);
    });
    this.logger.log(`Subscribed to Redis channel "${CHAT_CONTROL_CHANNEL}"`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sub) {
      await this.sub.quit();
    }
  }

  private async handle(raw: string): Promise<void> {
    const message = this.parse(raw);
    if (!message) {
      return;
    }
    try {
      await this.revoke(message);
    } catch (error) {
      this.logger.error(`Failed to apply chat control: ${String(error)}`);
    }
  }

  private async revoke(message: ChatControlMessage): Promise<void> {
    const conversation = await this.repo.findGroupByReference(message.groupId);
    if (!conversation) {
      // No chat was ever opened for this group — nothing to revoke.
      return;
    }

    const userIds =
      message.target.kind === 'user'
        ? [message.target.userId]
        : await this.repo.findParticipantUserIds(conversation.id);

    // Prune first (the real security control: the membership gate now fails for
    // a reconnect or a replay), then best-effort kick any live sockets.
    if (message.target.kind === 'user') {
      await this.repo.deleteParticipant(conversation.id, message.target.userId);
    } else {
      await this.repo.deleteAllParticipants(conversation.id);
    }
    for (const userId of userIds) {
      this.gateway.revoke(userId, conversation.id, message.groupId);
    }
    this.logger.log(
      `Revoked ${userIds.length} participant(s) from group ${message.groupId} chat`,
    );
  }

  private parse(raw: string): ChatControlMessage | null {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.logger.warn('Dropped malformed chat-control message (invalid JSON)');
      return null;
    }
    const result = chatControlSchema.safeParse(json);
    if (!result.success) {
      this.logger.warn('Dropped chat-control message with unexpected shape');
      return null;
    }
    return result.data;
  }
}
