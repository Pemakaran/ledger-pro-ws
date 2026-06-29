/** A participant's role within a conversation. */
export const PARTICIPANT_ROLES = ['member', 'admin'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];
