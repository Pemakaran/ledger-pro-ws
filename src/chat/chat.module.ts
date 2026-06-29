import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@common/auth/auth.module';
import { JwksAuthGuard } from '@common/auth/jwks-auth.guard';
import { Conversation } from '@chat/entities/conversation.entity';
import { ConversationParticipant } from '@chat/entities/conversation-participant.entity';
import { Message } from '@chat/entities/message.entity';
import { ChatRepository } from '@chat/chat.repository';
import { ChatService } from '@chat/chat.service';
import { ChatController } from '@chat/chat.controller';
import { ChatGateway } from '@chat/chat.gateway';

/**
 * Chat domain — persistence (entities + repository), logic (service), and both
 * edges: the REST controller (history/admin) and the /chat WebSocket gateway
 * (live messaging). AuthModule supplies the JWKS verifier the gateway and the
 * HTTP guard share. Entities are auto-loaded by DatabaseModule.
 */
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Conversation, ConversationParticipant, Message]),
  ],
  controllers: [ChatController],
  providers: [ChatRepository, ChatService, ChatGateway, JwksAuthGuard],
  exports: [ChatService],
})
export class ChatModule {}
