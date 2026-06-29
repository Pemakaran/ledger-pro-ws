import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Message } from '@chat/entities/message.entity';

/**
 * A file attached to a chat message. The backend uploads the bytes to Cloudinary
 * and returns the metadata; the realtime service only persists that metadata
 * (it never touches Cloudinary). `url` is always an https Cloudinary URL.
 */
@Entity('chat_message_attachments')
@Index(['messageId'])
export class MessageAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'message_id' })
  messageId!: string;

  @ManyToOne(() => Message, (message) => message.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message!: Message;

  @Column({ type: 'varchar' })
  url!: string;

  /** Page-1 preview for documents (e.g. PDFs); null when none was derived. */
  @Column({ type: 'varchar', name: 'thumbnail_url', nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: 'varchar', name: 'public_id' })
  publicId!: string;

  @Column({ type: 'varchar', name: 'mime_type' })
  mimeType!: string;

  @Column({ type: 'varchar', name: 'file_name' })
  fileName!: string;

  /** Bytes. */
  @Column({ type: 'int' })
  size!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
