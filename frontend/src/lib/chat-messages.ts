import type { Message } from '@workspace/api-client-react';

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
