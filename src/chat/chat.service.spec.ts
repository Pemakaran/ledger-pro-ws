import { ForbiddenException } from '@nestjs/common';
import { ChatService } from '@chat/chat.service';
import type { ChatRepository } from '@chat/chat.repository';
import type { ConversationParticipant } from '@chat/entities/conversation-participant.entity';

function setup(
  participant: ConversationParticipant | null = {
    id: 'p1',
  } as ConversationParticipant,
) {
  const repo = {
    createConversation: jest.fn().mockResolvedValue({ id: 'c1' }),
    findConversationsForUser: jest.fn().mockResolvedValue([]),
    findParticipant: jest.fn().mockResolvedValue(participant),
    saveMessage: jest
      .fn()
      .mockImplementation(
        (conversationId: string, senderId: string, body: string) =>
          Promise.resolve({ id: 'm1', conversationId, senderId, body }),
      ),
    findMessages: jest.fn().mockResolvedValue([]),
    markRead: jest.fn().mockResolvedValue(undefined),
  } as unknown as ChatRepository;
  return { service: new ChatService(repo), repo };
}

describe('ChatService', () => {
  it('always includes the actor as a participant of a new conversation', async () => {
    const { service, repo } = setup();
    await service.createConversation('u1', {
      type: 'direct',
      participantIds: ['u2'],
    });
    expect(repo.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        createdById: 'u1',
        participantIds: expect.arrayContaining(['u1', 'u2']),
      }),
    );
  });

  it('persists a message when the sender is a participant', async () => {
    const { service, repo } = setup();
    const msg = await service.postMessage('u1', 'c1', 'hi');
    expect(repo.saveMessage).toHaveBeenCalledWith('c1', 'u1', 'hi');
    expect(msg).toMatchObject({
      conversationId: 'c1',
      senderId: 'u1',
      body: 'hi',
    });
  });

  it('rejects a non-participant trying to post', async () => {
    const { service, repo } = setup(null);
    await expect(
      service.postMessage('intruder', 'c1', 'hi'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.saveMessage).not.toHaveBeenCalled();
  });

  it('authorizes before reading history', async () => {
    const { service, repo } = setup(null);
    await expect(
      service.getHistory('intruder', 'c1', 50),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.findMessages).not.toHaveBeenCalled();
  });
});
