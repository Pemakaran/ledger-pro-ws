import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '@chat/entities/conversation.entity';
import { ConversationParticipant } from '@chat/entities/conversation-participant.entity';
import { Message } from '@chat/entities/message.entity';
import { ChatRepository } from '@chat/chat.repository';
import { ChatService } from '@chat/chat.service';

/**
 * Chat domain. forFeature registers the entities (auto-loaded by DatabaseModule).
 * The /chat gateway + REST controller are wired in the next slice; the service
 * is exported so both can drive it.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationParticipant, Message]),
  ],
  providers: [ChatRepository, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
