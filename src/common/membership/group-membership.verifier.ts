import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Authorizes group access by asking the backend whether the caller belongs to
 * the customer-group. Reuses the existing membership-gated endpoint
 * `GET /api/v1/customer-groups/:id` (200 for members, 403 for non-members) — so
 * neither group chat nor the group cart-sync room needs a new backend surface.
 *
 * A backend outage must never be read as "not a member" (that would silently
 * lock everyone out or, worse, mask a misconfig), so anything other than a clean
 * 2xx / 403 / 404 surfaces as 503.
 */
@Injectable()
export class GroupMembershipVerifier {
  private readonly logger = new Logger(GroupMembershipVerifier.name);

  constructor(private readonly config: ConfigService) {}

  async verify(groupId: string, bearerToken: string): Promise<boolean> {
    const baseUrl = this.config.get<string>(
      'BACKEND_BASE_URL',
      'http://localhost:3000',
    );

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v1/customer-groups/${groupId}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
    } catch (error) {
      this.logger.error(
        `Membership check could not reach the backend: ${String(error)}`,
      );
      throw new ServiceUnavailableException('Membership check unavailable');
    }

    if (response.ok) {
      // Archiving a group keeps its member rows, so a 200 alone isn't enough:
      // treat an archived group as "not a member" so an archived (or revoked)
      // chat can't be re-opened.
      const body: unknown = await response.json().catch(() => null);
      const status = (body as { data?: { status?: string } } | null)?.data
        ?.status;
      return status !== 'archived';
    }
    if (response.status === 403 || response.status === 404) {
      return false;
    }
    this.logger.error(
      `Membership check returned an unexpected ${response.status}`,
    );
    throw new ServiceUnavailableException('Membership check unavailable');
  }
}
