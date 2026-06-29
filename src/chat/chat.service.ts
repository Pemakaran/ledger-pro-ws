import { ForbiddenException, Injectable } from '@nestjs/common';
import { ChatRepository } from '@chat/chat.repository';
import { Conversation } from '@chat/entities/conversation.entity';
import { ConversationParticipant } from '@chat/entities/conversation-participant.entity';
import { Message } from '@chat/entities/message.entity';
import type { ConversationType } from '@chat/enums/conversation-type.enum';

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
 * or post a message.
 */
@Injectable()
export class ChatService {
  constructor(private readonly repo: ChatRepository) {}

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
  ): Promise<Message> {
    await this.assertParticipant(conversationId, actorId);
    return this.repo.saveMessage(conversationId, actorId, body);
  }

  async markRead(actorId: string, conversationId: string): Promise<void> {
    await this.assertParticipant(conversationId, actorId);
    await this.repo.markRead(conversationId, actorId, new Date());
  }
}
