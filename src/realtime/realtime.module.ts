import { Module } from '@nestjs/common';
import { AuthModule } from '@common/auth/auth.module';
import { RealtimeGateway } from '@realtime/realtime.gateway';
import { RealtimeSubscriber } from '@realtime/realtime.subscriber';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeSubscriber],
})
export class RealtimeModule {}
