import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatService } from '@chat/chat.service';
import type { ChatRepository } from '@chat/chat.repository';
import type { GroupMembershipVerifier } from '@common/membership/group-membership.verifier';
import type { ConversationParticipant } from '@chat/entities/conversation-participant.entity';
import type { AttachmentInput } from '@chat/schema/attachment.schema';

function setup(options?: {
  participant?: ConversationParticipant | null;
  isMember?: boolean;
}) {
  const participant =
    options && 'participant' in options
      ? options.participant
      : ({ id: 'p1' } as ConversationParticipant);

  const repo = {
    createConversation: jest.fn().mockResolvedValue({ id: 'c1' }),
    findConversationsForUser: jest.fn().mockResolvedValue([]),
    findOrCreateGroupConversation: jest
      .fn()
      .mockResolvedValue({ id: 'group-conv', type: 'group' }),
    findParticipant: jest.fn().mockResolvedValue(participant),
    saveMessage: jest
      .fn()
      .mockImplementation(
        (
          conversationId: string,
          senderId: string,
          body: string,
          attachments: AttachmentInput[],
        ) =>
          Promise.resolve({
            id: 'm1',
            conversationId,
            senderId,
            body,
            attachments,
          }),
      ),
    findMessages: jest.fn().mockResolvedValue([]),
    markRead: jest.fn().mockResolvedValue(undefined),
  } as unknown as ChatRepository;

  const membership = {
    verify: jest.fn().mockResolvedValue(options?.isMember ?? true),
  } as unknown as GroupMembershipVerifier;

  return { service: new ChatService(repo, membership), repo, membership };
}

const imageAttachment: AttachmentInput = {
  url: 'https://cdn.example.com/a.png',
  publicId: 'chat/a',
  mimeType: 'image/png',
  fileName: 'a.png',
  size: 1234,
};

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
    expect(repo.saveMessage).toHaveBeenCalledWith('c1', 'u1', 'hi', []);
    expect(msg).toMatchObject({
      conversationId: 'c1',
      senderId: 'u1',
      body: 'hi',
    });
  });

  it('rejects a non-participant trying to post', async () => {
    const { service, repo } = setup({ participant: null });
    await expect(
      service.postMessage('intruder', 'c1', 'hi'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.saveMessage).not.toHaveBeenCalled();
  });

  it('authorizes before reading history', async () => {
    const { service, repo } = setup({ participant: null });
    await expect(
      service.getHistory('intruder', 'c1', 50),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.findMessages).not.toHaveBeenCalled();
  });

  it('rejects an empty message with no attachments', async () => {
    const { service, repo } = setup();
    await expect(service.postMessage('u1', 'c1', '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.saveMessage).not.toHaveBeenCalled();
  });

  it('allows an attachment-only message (empty body)', async () => {
    const { service, repo } = setup();
    await service.postMessage('u1', 'c1', '', [imageAttachment]);
    expect(repo.saveMessage).toHaveBeenCalledWith('c1', 'u1', '', [
      imageAttachment,
    ]);
  });

  it('opens a group conversation for a verified member', async () => {
    const { service, repo, membership } = setup({ isMember: true });
    const conv = await service.openGroupConversation('u1', 'g1', 'token-xyz');
    expect(membership.verify).toHaveBeenCalledWith('g1', 'token-xyz');
    expect(repo.findOrCreateGroupConversation).toHaveBeenCalledWith('g1', 'u1');
    expect(conv).toMatchObject({ type: 'group' });
  });

  it('refuses to open a group conversation for a non-member', async () => {
    const { service, repo } = setup({ isMember: false });
    await expect(
      service.openGroupConversation('intruder', 'g1', 'token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.findOrCreateGroupConversation).not.toHaveBeenCalled();
  });
});
