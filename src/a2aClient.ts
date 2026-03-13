import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { ClientFactory } from '@a2a-js/sdk/client';
import { Message, MessageSendParams, Task } from '@a2a-js/sdk';

// Load configuration from .env at project root
dotenv.config();

type AgentChoice = 'research' | 'policy';

async function main(agent: AgentChoice, question: string) {
  const port =
    agent === 'policy'
      ? process.env.POLICY_AGENT_PORT || '4000'
      : process.env.RESEARCH_AGENT_PORT || '4001';
  const baseUrl = `http://localhost:${port}`;

  // Create an A2A client from the agent card URL
  const factory = new ClientFactory();
  const client = await factory.createFromUrl(baseUrl);

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
      console.log('Agent answer (message):', firstPart.text);
      return;
    }
  } else if (response.kind === 'task') {
    const task = response as Task;

    // Check and print task status
    console.log('Task id:', task.id);
    console.log('Task status state:', task.status.state);
    if (task.status.timestamp) {
      console.log('Task status timestamp:', task.status.timestamp);
    }

    // Print message parts in status object
    if (task.status.message?.parts) {
      console.log('Task status message parts:');
      for (const part of task.status.message.parts) {
        if (part.kind === 'text') {
          console.log('  - text:', part.text);
        } else if (part.kind === 'file') {
          const file = part.file;
          console.log('  - file:', file && 'uri' in file ? file.uri : file);
        } else {
          console.log('  -', part.kind, part);
        }
      }
    }

    if (task.artifacts && task.artifacts.length > 0) {
      console.log(`Artifact found: ${task.artifacts[0].name}`);
      if (task.artifacts[0].parts[0].kind === 'text') {
        console.log(`Artifact Content: ${task.artifacts[0].parts[0].text}`);
      } else {
        console.log(`Artifact Content: ${task.artifacts[0].parts[0]}`);
      }
    }
    return;
  }

  // eslint-disable-next-line no-console
  console.log('Received unexpected response:', response);
}

const agent = process.argv[2] as AgentChoice | undefined;
const question = process.argv.slice(3).join(' ');
if (!agent || !question || (agent !== 'research' && agent !== 'policy')) {
  console.error('Usage: ts-node a2aClient.ts <research|policy> <question>');
  process.exit(1);
}
void main(agent, question);

