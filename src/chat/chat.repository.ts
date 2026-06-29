import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { Conversation } from '@chat/entities/conversation.entity';
import { ConversationParticipant } from '@chat/entities/conversation-participant.entity';
import { Message } from '@chat/entities/message.entity';
import { MessageAttachment } from '@chat/entities/message-attachment.entity';
import type { ConversationType } from '@chat/enums/conversation-type.enum';
import type { AttachmentInput } from '@chat/schema/attachment.schema';

interface CreateConversationInput {
  type: ConversationType;
  title: string | null;
  referenceId: string | null;
  createdById: string;
  participantIds: string[];
}

/** Postgres unique-violation SQLSTATE. */
const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
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
    @InjectRepository(MessageAttachment)
    private readonly attachments: Repository<MessageAttachment>,
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

  /**
   * The single chat for a customer-group: find the `group` conversation by its
   * referenceId (the group id) or create it, then idempotently ensure the actor
   * is a participant. The partial-unique index on reference_id makes concurrent
   * creates safe — the loser catches the unique violation and reuses the winner.
   */
  async findOrCreateGroupConversation(
    groupId: string,
    actorId: string,
  ): Promise<Conversation> {
    const existing = await this.findGroupByReference(groupId);
    if (existing) {
      await this.ensureParticipant(existing.id, actorId);
      return existing;
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        const conversation = await manager.save(
          manager.create(Conversation, {
            type: 'group',
            referenceId: groupId,
            createdById: actorId,
          }),
        );
        await manager.save(
          manager.create(ConversationParticipant, {
            conversationId: conversation.id,
            userId: actorId,
            role: 'admin',
          }),
        );
        return conversation;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.findGroupByReference(groupId);
        if (winner) {
          await this.ensureParticipant(winner.id, actorId);
          return winner;
        }
      }
      throw error;
    }
  }

  private findGroupByReference(groupId: string): Promise<Conversation | null> {
    return this.conversations.findOne({
      where: { type: 'group', referenceId: groupId },
    });
  }

  /** Add the participant if absent (ON CONFLICT DO NOTHING on the unique index). */
  private async ensureParticipant(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.participants
      .createQueryBuilder()
      .insert()
      .values({ conversationId, userId, role: 'member' })
      .orIgnore()
      .execute();
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

  /** Persist a message and its attachments (cascade insert) in one round-trip. */
  saveMessage(
    conversationId: string,
    senderId: string,
    body: string,
    attachments: AttachmentInput[] = [],
  ): Promise<Message> {
    return this.messages.save(
      this.messages.create({
        conversationId,
        senderId,
        body,
        attachments: attachments.map((a) =>
          this.attachments.create({
            url: a.url,
            publicId: a.publicId,
            mimeType: a.mimeType,
            fileName: a.fileName,
            size: a.size,
          }),
        ),
      }),
    );
  }

  /** Newest-first page of history (with attachments), optionally before a cursor. */
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
      relations: { attachments: true },
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
