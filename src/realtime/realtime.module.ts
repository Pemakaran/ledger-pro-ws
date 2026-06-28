import { Module } from '@nestjs/common';
import { AuthModule } from '@common/auth/auth.module';
import { RealtimeGateway } from '@realtime/realtime.gateway';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
