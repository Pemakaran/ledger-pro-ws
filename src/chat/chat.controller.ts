import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwksAuthGuard,
  type AuthedRequest,
} from '@common/auth/jwks-auth.guard';
import { ChatService } from '@chat/chat.service';
import {
  CreateConversationDto,
  HistoryQueryDto,
  SendMessageDto,
} from '@chat/schema';

/**
 * REST surface for chat: list/create conversations, paginated history, and
 * mark-read. Every route is JWKS-guarded and scoped to the caller; the service
 * enforces participant membership, so one user can't read another's threads.
 */
@UseGuards(JwksAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  listConversations(@Req() req: AuthedRequest) {
    return this.chat.listConversations(req.user.sub);
  }

  @Post('conversations')
  createConversation(
    @Req() req: AuthedRequest,
    @Body() dto: CreateConversationDto,
  ) {
    return this.chat.createConversation(req.user.sub, dto);
  }

  @Get('conversations/:id/messages')
  history(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.chat.getHistory(req.user.sub, id, query.limit, query.before);
  }

  @Post('conversations/:id/messages')
  postMessage(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.postMessage(req.user.sub, id, dto.body);
  }

  @Post('conversations/:id/read')
  markRead(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.markRead(req.user.sub, id);
  }
}
