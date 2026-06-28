import { Controller, Get, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@common/redis/redis.constants';

@Controller('health')
export class HealthController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Liveness — the process is up. Used by the container healthcheck. */
  @Get()
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness — dependencies (Redis) are reachable. */
  @Get('ready')
  async readiness(): Promise<{ status: string; redis: string }> {
    const pong = await this.redis.ping().catch(() => 'down');
    const up = pong === 'PONG';
    return { status: up ? 'ok' : 'degraded', redis: up ? 'up' : 'down' };
  }
}
