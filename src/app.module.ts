import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '@common/schema';
import { RedisModule } from '@common/redis/redis.module';
import { AuthModule } from '@common/auth/auth.module';
import { RealtimeModule } from '@realtime/realtime.module';
import { HealthModule } from '@health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    RedisModule,
    AuthModule,
    RealtimeModule,
    HealthModule,
  ],
})
export class AppModule {}
