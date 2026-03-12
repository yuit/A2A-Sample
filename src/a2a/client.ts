import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { ClientFactory } from '@a2a-js/sdk/client';
import { Message, MessageSendParams } from '@a2a-js/sdk';

// Load configuration from .env at project root
dotenv.config();

async function main() {
  const port = process.env.POLICY_AGENT_PORT || '4000';
  const baseUrl = `http://localhost:${port}`;

  // Create an A2A client from the agent card URL
  const factory = new ClientFactory();
  const client = await factory.createFromUrl(baseUrl);

  const question = 'Does emergency visit cover in the policy?';

  const message: Message = {
    kind: 'message',
    messageId: uuidv4(),
    role: 'user',
    parts: [{ kind: 'text', text: question }],
  };

  const params: MessageSendParams = {
    message,
  };

  const response = await client.sendMessage(params);

  if (response.kind === 'message') {
    const msg = response as Message;
    const firstPart = msg.parts[0];
    if (firstPart && firstPart.kind === 'text') {
      // eslint-disable-next-line no-console
      console.log('Agent answer:', firstPart.text);
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.log('Received non-message response:', response);
}

void main();

