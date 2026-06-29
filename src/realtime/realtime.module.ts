import { Module } from '@nestjs/common';
import { AuthModule } from '@common/auth/auth.module';
import { MembershipModule } from '@common/membership/membership.module';
import { RealtimeGateway } from '@realtime/realtime.gateway';
import { RealtimeSubscriber } from '@realtime/realtime.subscriber';

@Module({
  imports: [AuthModule, MembershipModule],
  providers: [RealtimeGateway, RealtimeSubscriber],
})
export class RealtimeModule {}
