import dotenv from 'dotenv';
import { AGENT_CARD_PATH, AgentCard } from '@a2a-js/sdk';
import {
  DefaultRequestHandler,
  InMemoryTaskStore,
  type AgentExecutor,
} from '@a2a-js/sdk/server';
import express from 'express';
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from '@a2a-js/sdk/server/express';
dotenv.config();

type A2AAgentConfig = {
  executor: AgentExecutor;
  name?: string;
  agentCard: AgentCard;
  url: string;
  port?: string;
}
/**
 * Initialize an A2A server for a given agent configuration.
 * Returns the Express app and requestHandler so the caller can attach .listen().
 */
export function initA2AServer(config: A2AAgentConfig) {
  const { executor, agentCard, url, port, name } = config;
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

  app.listen(port, () => {
    console.log(`🚀 Server started on ${url}`);
    console.log(`Agent card: ${url}/${AGENT_CARD_PATH}`);
  });
}