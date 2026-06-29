import { Module } from '@nestjs/common';
import { GroupMembershipVerifier } from '@common/membership/group-membership.verifier';

/**
 * Shared group-membership authorization. Both the /chat gateway (group chat) and
 * the /notifications gateway (the group cart-sync room) gate on customer-group
 * membership against the backend, so the verifier lives here rather than inside
 * either domain module.
 */
@Module({
  providers: [GroupMembershipVerifier],
  exports: [GroupMembershipVerifier],
})
export class MembershipModule {}
