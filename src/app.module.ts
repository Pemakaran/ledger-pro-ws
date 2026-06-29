import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '@common/schema';
import { DatabaseModule } from '@common/database/database.module';
import { RedisModule } from '@common/redis/redis.module';
import { AuthModule } from '@common/auth/auth.module';
import { RealtimeModule } from '@realtime/realtime.module';
import { HealthModule } from '@health/health.module';
import { ChatModule } from '@chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    RealtimeModule,
    HealthModule,
    ChatModule,
  ],
})
export class AppModule {}
