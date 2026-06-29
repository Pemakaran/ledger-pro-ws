import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from '@chat/entities/conversation.entity';
import type { ParticipantRole } from '@chat/enums/participant-role.enum';

@Entity('chat_participants')
@Index(['conversationId', 'userId'], { unique: true })
export class ConversationParticipant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', default: 'member' })
  role!: ParticipantRole;

  /** When this participant last read the thread (for unread counts). */
  @Column({ type: 'timestamptz', name: 'last_read_at', nullable: true })
  lastReadAt!: Date | null;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;
}
