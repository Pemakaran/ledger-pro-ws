import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ChatRepository } from '@chat/chat.repository';
import { GroupMembershipVerifier } from '@common/membership/group-membership.verifier';
import { Conversation } from '@chat/entities/conversation.entity';
import { ConversationParticipant } from '@chat/entities/conversation-participant.entity';
import { Message } from '@chat/entities/message.entity';
import type { ConversationType } from '@chat/enums/conversation-type.enum';
import type { AttachmentInput } from '@chat/schema/attachment.schema';

interface CreateConversationInput {
  type: ConversationType;
  title?: string | null;
  referenceId?: string | null;
  participantIds: string[];
}

/**
 * Chat domain logic. Every read/write is gated on participant membership —
 * {@link assertParticipant} is the single authorization check the gateway and
 * the REST controller both go through, so a non-member can never read history
 * or post a message. For group chat, {@link openGroupConversation} first
 * verifies customer-group membership with the backend, then find-or-creates the
 * group's conversation and enrolls the caller; thereafter the same participant
 * gate applies.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly membership: GroupMembershipVerifier,
  ) {}

  /** Create a conversation; the actor is always included (as the admin). */
  createConversation(
    actorId: string,
    input: CreateConversationInput,
  ): Promise<Conversation> {
    return this.repo.createConversation({
      type: input.type,
      title: input.title ?? null,
      referenceId: input.referenceId ?? null,
      createdById: actorId,
      participantIds: [actorId, ...input.participantIds],
    });
  }

  listConversations(actorId: string): Promise<Conversation[]> {
    return this.repo.findConversationsForUser(actorId);
  }

  /**
   * Open (find-or-create) the chat for a customer-group, after verifying the
   * caller belongs to it. Idempotent — repeated opens reuse the same
   * conversation and re-confirm membership (a removed member gets 403).
   */
  async openGroupConversation(
    actorId: string,
    groupId: string,
    bearerToken: string,
  ): Promise<Conversation> {
    const isMember = await this.membership.verify(groupId, bearerToken);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this group');
    }
    return this.repo.findOrCreateGroupConversation(groupId, actorId);
  }

  /** Returns the membership, or throws Forbidden if the user isn't in it. */
  async assertParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipant> {
    const participant = await this.repo.findParticipant(conversationId, userId);
    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }
    return participant;
  }

  async getHistory(
    actorId: string,
    conversationId: string,
    limit: number,
    before?: Date,
  ): Promise<Message[]> {
    await this.assertParticipant(conversationId, actorId);
    return this.repo.findMessages(conversationId, limit, before);
  }

  async postMessage(
    actorId: string,
    conversationId: string,
    body: string,
    attachments: AttachmentInput[] = [],
  ): Promise<Message> {
    if (body.trim().length === 0 && attachments.length === 0) {
      throw new BadRequestException('A message needs text or an attachment');
    }
    await this.assertParticipant(conversationId, actorId);
    return this.repo.saveMessage(conversationId, actorId, body, attachments);
  }

  async markRead(actorId: string, conversationId: string): Promise<Date> {
    await this.assertParticipant(conversationId, actorId);
    const at = new Date();
    await this.repo.markRead(conversationId, actorId, at);
    return at;
  }

  /** Participants of a conversation with their read cursors (for read receipts). */
  async getParticipants(
    actorId: string,
    conversationId: string,
  ): Promise<ConversationParticipant[]> {
    await this.assertParticipant(conversationId, actorId);
    return this.repo.listParticipants(conversationId);
  }
}
