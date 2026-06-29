import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { Conversation } from '@chat/entities/conversation.entity';
import { ConversationParticipant } from '@chat/entities/conversation-participant.entity';
import { Message } from '@chat/entities/message.entity';
import type { ConversationType } from '@chat/enums/conversation-type.enum';

interface CreateConversationInput {
  type: ConversationType;
  title: string | null;
  referenceId: string | null;
  createdById: string;
  participantIds: string[];
}

/**
 * Persistence boundary for chat. Upper layers never see TypeORM; they call these
 * methods. The creator becomes an `admin` participant, everyone else a `member`.
 */
@Injectable()
export class ChatRepository {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participants: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    private readonly dataSource: DataSource,
  ) {}

  /** Create a conversation and its participants atomically. */
  async createConversation(
    input: CreateConversationInput,
  ): Promise<Conversation> {
    return this.dataSource.transaction(async (manager) => {
      const conversation = await manager.save(
        manager.create(Conversation, {
          type: input.type,
          title: input.title,
          referenceId: input.referenceId,
          createdById: input.createdById,
        }),
      );
      const rows = [...new Set(input.participantIds)].map((userId) =>
        manager.create(ConversationParticipant, {
          conversationId: conversation.id,
          userId,
          role: userId === input.createdById ? 'admin' : 'member',
        }),
      );
      await manager.save(rows);
      return conversation;
    });
  }

  findParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipant | null> {
    return this.participants.findOne({ where: { conversationId, userId } });
  }

  /** Conversations the user belongs to, most-recently-joined first. */
  async findConversationsForUser(userId: string): Promise<Conversation[]> {
    const memberships = await this.participants.find({
      where: { userId },
      relations: { conversation: true },
      order: { joinedAt: 'DESC' },
    });
    return memberships.map((m) => m.conversation);
  }

  saveMessage(
    conversationId: string,
    senderId: string,
    body: string,
  ): Promise<Message> {
    return this.messages.save(
      this.messages.create({ conversationId, senderId, body }),
    );
  }

  /** Newest-first page of history, optionally before a cursor timestamp. */
  findMessages(
    conversationId: string,
    limit: number,
    before?: Date,
  ): Promise<Message[]> {
    return this.messages.find({
      where: {
        conversationId,
        ...(before ? { createdAt: LessThan(before) } : {}),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async markRead(
    conversationId: string,
    userId: string,
    at: Date,
  ): Promise<void> {
    await this.participants.update(
      { conversationId, userId },
      { lastReadAt: at },
    );
  }
}
