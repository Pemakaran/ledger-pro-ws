import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@common/redis/redis.constants';
import { RealtimeGateway } from '@realtime/realtime.gateway';
import {
  REALTIME_CHANNEL,
  targetRoom,
  type RealtimeEnvelope,
} from '@common/contract/realtime-event.type';

/**
 * Subscribes to the backend's Redis channel and fans each envelope out to the
 * right socket.io room. This is the consuming half of the inter-service bus:
 * the backend PUBLISHes, this emits to connected clients (the Redis adapter
 * then delivers across every replica).
 */
@Injectable()
export class RealtimeSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeSubscriber.name);
  private readonly channel: string;
  private sub?: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly gateway: RealtimeGateway,
    config: ConfigService,
  ) {
    this.channel = config.get<string>(
      'REALTIME_REDIS_CHANNEL',
      REALTIME_CHANNEL,
    );
  }

  async onModuleInit(): Promise<void> {
    // A connection in subscribe mode can't run other commands, so duplicate.
    this.sub = this.redis.duplicate();
    await this.sub.subscribe(this.channel);
    this.sub.on('message', (_channel, raw) => this.dispatch(raw));
    this.logger.log(`Subscribed to Redis channel "${this.channel}"`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sub) {
      await this.sub.quit();
    }
  }

  private dispatch(raw: string): void {
    const envelope = this.parse(raw);
    if (!envelope) {
      return;
    }

    const ns = this.gateway.namespaceFor(envelope.namespace);
    if (!ns) {
      this.logger.warn(
        `Namespace ${envelope.namespace} not ready; dropped "${envelope.event}"`,
      );
      return;
    }

    const room = targetRoom(envelope.target);
    if (room) {
      ns.to(room).emit(envelope.event, envelope.payload);
    } else {
      ns.emit(envelope.event, envelope.payload);
    }
  }

  private parse(raw: string): RealtimeEnvelope | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('Dropped malformed realtime envelope (invalid JSON)');
      return null;
    }
    if (!this.isEnvelope(parsed)) {
      this.logger.warn('Dropped realtime envelope with unexpected shape');
      return null;
    }
    return parsed;
  }

  private isEnvelope(value: unknown): value is RealtimeEnvelope {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const e = value as Record<string, unknown>;
    return (
      e.v === 1 &&
      typeof e.event === 'string' &&
      typeof e.namespace === 'string' &&
      typeof e.target === 'object' &&
      e.target !== null
    );
  }
}
