import type { Conversation, Message } from '@workspace/api-client-react';
import { DELETED_MESSAGE_TYPE } from '@workspace/api-zod';

/** Name to show for the other person of a chat; `deletedLabel` when they deleted their account. */
export function participantName(conversation: Pick<Conversation, 'participant' | 'participantDeleted'>, deletedLabel: string): string {
  return conversation.participantDeleted ? deletedLabel : conversation.participant;
}

/** True for a message whose author deleted their account (its text was removed). */
export function isDeletedMessage(message: Pick<Message, 'tipo'>): boolean {
  return message.tipo === DELETED_MESSAGE_TYPE;
}

type MessagePayload = Omit<Message, 'kind'> & {
  kind?: string;
  tipo?: string;
};

export function normalizeMessage(message: MessagePayload): Message {
  return {
    ...message,
    kind: message.kind === 'system' || message.tipo === 'sistema' ? 'system' : 'user',
  };
}

export function normalizeMessages(messages: MessagePayload[]): Message[] {
  return messages.map(normalizeMessage);
}
