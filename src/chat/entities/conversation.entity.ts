import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ConversationType } from '@chat/enums/conversation-type.enum';

@Entity('chat_conversations')
// One chat per customer-group: a partial-unique index on reference_id for
// 'group' conversations guards the find-or-create race in openGroupConversation.
@Index('UQ_chat_conversations_group_reference', ['referenceId'], {
  unique: true,
  where: "type = 'group'",
})
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 'direct' | 'group' | 'support' — validated at the edge by Zod. */
  @Column({ type: 'varchar' })
  type!: ConversationType;

  @Column({ type: 'varchar', nullable: true })
  title!: string | null;

  /** Links a 'group' conversation to its customer-group id (else null). */
  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId!: string | null;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
