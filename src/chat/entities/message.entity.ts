import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from '@chat/entities/conversation.entity';
import { MessageAttachment } from '@chat/entities/message-attachment.entity';

@Entity('chat_messages')
// Paginating history reads (conversation_id, created_at DESC).
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ type: 'uuid', name: 'sender_id' })
  senderId!: string;

  @Column({ type: 'text' })
  body!: string;

  @OneToMany(() => MessageAttachment, (attachment) => attachment.message, {
    cascade: ['insert'],
  })
  attachments!: MessageAttachment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
