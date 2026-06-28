import { Module } from '@nestjs/common';
import { JwksVerifierService } from '@common/auth/jwks-verifier.service';

@Module({
  providers: [JwksVerifierService],
  exports: [JwksVerifierService],
})
export class AuthModule {}
