import dotenv from 'dotenv';
import { AGENT_CARD_PATH, AgentCard } from '@a2a-js/sdk';
import type { AgentExecutor } from '@a2a-js/sdk/server';
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
} from '@a2a-js/sdk/server';
import express from 'express';
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from '@a2a-js/sdk/server/express';
import { policyAgentMessageExecutor } from './policyAgentExecutor';
import { policyAgentTaskExecutor } from './policyAgentTaskExecutor';

dotenv.config();

// Parse --executor=name or -e name (default: policyAgent)
function getExecutorName(): string {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--executor' && process.argv[i + 1]) {
      return process.argv[i + 1];
    }
    if (arg.startsWith('--executor=')) {
      return arg.slice('--executor='.length);
    }
    if ((arg === '-e' && process.argv[i + 1])) {
      return process.argv[i + 1];
    }
  }
  return 'policyAgent';
}

const executorName = getExecutorName();

const PORT = process.env.POLICY_AGENT_PORT || '4000';
const BASE_URL = `http://localhost:${PORT}`;

const agentCards: Record<string, AgentCard> = {
  policyAgent: {
    name: 'Policy Agent',
    description: 'Answers healthcare policy questions using an internal PDF.',
    protocolVersion: '0.3.0',
    version: '0.1.0',
    url: BASE_URL,
    skills: [
      {
        id: 'insurance_coverage',
        name: 'Insurance coverage',
        description: 'Provides information about insurance coverage options and details.',
        tags: ['insurance', 'coverage'],
        examples: ['What does my policy cover?', 'Are mental health services included?'],
      },
    ],
    capabilities: { pushNotifications: false },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    additionalInterfaces: [
      { url: `${BASE_URL}/a2a/jsonrpc`, transport: 'JSONRPC' },
      { url: `${BASE_URL}/a2a/rest`, transport: 'HTTP+JSON' },
    ],
  },
  task: {
    name: 'Policy Task Agent',
    description: 'Answers healthcare policy questions using an internal PDF that returns a Task with an artifact.',
    protocolVersion: '0.3.0',
    version: '0.1.0',
    url: `${BASE_URL}/a2a/jsonrpc`,
    skills: [
      {
        id: 'insurance_coverage',
        name: 'Insurance coverage',
        description: 'Provides information about insurance coverage options and details.',
        tags: ['insurance', 'coverage'],
        examples: ['What does my policy cover?', 'Are mental health services included?'],
      },
    ],
    capabilities: { pushNotifications: false },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    additionalInterfaces: [
      { url: `${BASE_URL}/a2a/jsonrpc`, transport: 'JSONRPC' },
      { url: `${BASE_URL}/a2a/rest`, transport: 'HTTP+JSON' },
    ],
  },
};

const agentCard = agentCards[executorName] ?? agentCards.policyAgent;

let executor: AgentExecutor;
if (executorName === 'policyAgentTask') {
  executor = new policyAgentTaskExecutor();
} else {
  executor = new policyAgentMessageExecutor();
}

const taskStore = new InMemoryTaskStore();
const requestHandler = new DefaultRequestHandler(agentCard, taskStore, executor);

const app = express();

app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
app.use(
  '/a2a/jsonrpc',
  jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication })
);
app.use(
  '/a2a/rest',
  restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication })
);

app.listen(PORT, () => {
  console.log(`🚀 A2A server [executor=${executorName}] listening on ${BASE_URL}`);
  console.log(`Agent card: ${BASE_URL}/${AGENT_CARD_PATH}`);
});
