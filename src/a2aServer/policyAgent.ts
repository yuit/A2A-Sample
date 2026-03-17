import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentCard,
  Message,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
  TextPart,
} from '@a2a-js/sdk';
import {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import { initA2AServer } from './utils.js';
import { logger } from '../logger.js';

dotenv.config();

const GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
if (!GOOGLE_GENAI_API_KEY) {
  throw new Error('GOOGLE_GENAI_API_KEY is not set');
}
const POLICY_AGENT_PORT = process.env.POLICY_AGENT_PORT;
if (!POLICY_AGENT_PORT) {
  throw new Error('POLICY_AGENT_PORT is not set');
}

const VERTEX_AI = process.env.VERTEX_AI === 'true';
const POLICY_AGENT_MODEL = process.env.POLICY_AGENT_MODEL ?? 'gemini-3-flash-preview';
const SYSTEM_INSTRUCTION =
`
    You are healthcare policy expert. Answer the user's question based on the given policy document.
    If there is no information in the policy document, answer that YOU DON'T KNOW.
`;
const POLICY_AGENT_BASE_URL = `http://localhost:${POLICY_AGENT_PORT}`;
const APP_NAME = "HEALTHCARE_POLICY_AGENT";
const POLICY_AGENT_CARD: AgentCard = {
  name: 'Policy Agent',
  description: 'Answers healthcare policy questions using an internal PDF.',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: POLICY_AGENT_BASE_URL,
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
    { url: `${POLICY_AGENT_BASE_URL}/a2a/jsonrpc`, transport: 'JSONRPC' },
    { url: `${POLICY_AGENT_BASE_URL}/a2a/rest`, transport: 'HTTP+JSON' },
  ],
}

class policyAgent {
  private readonly pdfData: Buffer;

  constructor(pdfRelativePath: string = path.join(__dirname, '../..', 'data', '2026AnthemgHIPSBC.pdf')) {
    this.pdfData = fs.readFileSync(pdfRelativePath);
  }

  async answerQuery(userPrompt: string): Promise<string> {
    const client = new GoogleGenAI({
      apiKey: GOOGLE_GENAI_API_KEY,
      vertexai: VERTEX_AI,
    });

    const response = await client.models.generateContent({
      model: POLICY_AGENT_MODEL,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: userPrompt },
            {
              inlineData: {
                data: this.pdfData.toString('base64'),
                mimeType: 'application/pdf',
              },
            },
          ],
        },
      ],
    });

    return response.text ?? '';
  }
}


/**
 * A2A AgentExecutor that returns a message.
 */
// @ts-ignore TS6196 - reserved for CLI executor selection
class policyAgentMessageExecutor implements AgentExecutor {
  private readonly agent: policyAgent;

  constructor() {
    this.agent = new policyAgent();
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage, contextId } = requestContext;

    // Log basic info about the incoming request
    logger.debug(
      '[PolicyAgentExecutor] Incoming request',
      `contextId=${contextId ?? userMessage.contextId ?? 'none'}`
    );

    // Extract the user's text message from the RequestContext
    const textParts = (userMessage.parts ?? []).filter(
      (p): p is TextPart => p.kind === 'text'
    );
    const userText = textParts.map((p) => p.text).join('\n');

    const answer = await this.agent.answerQuery(userText);

    const responseMessage: Message = {
      kind: 'message',
      role: 'agent',
      messageId: uuidv4(),
      parts: [{ kind: 'text', text: answer }],
      contextId,
    };

    eventBus.publish(responseMessage);
    eventBus.finished();
  }

  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    // No internal long-running work to cancel yet; placeholder for future extension.
    // You might track in-flight tasks here if policyAgent does streaming or long operations.
    return;
  }
}

/**
 * A2A AgentExecutor that returns a Task: init task, create artifact, then finish task.
 * 
 */
// @ts-ignore TS6196 - reserved for CLI executor selection
class policyAgentTaskExecutor implements AgentExecutor {
  private readonly agent: policyAgent;
  constructor() {
    this.agent = new policyAgent();
  }
  
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId, userMessage, task } = requestContext;

    const effectiveTaskId = taskId ?? uuidv4();
    const effectiveContextId = contextId ?? userMessage.contextId ?? uuidv4();

    // 1. Init task: create and publish the initial task if it doesn't exist
    if (!task) {
      const initialTask: Task = {
        kind: 'task',
        id: effectiveTaskId,
        contextId: effectiveContextId,
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
      };
      eventBus.publish(initialTask);
    }
    
    // Log basic info about the incoming request
    logger.debug(
      '[PolicyAgentExecutor] Incoming request',
      `contextId=${contextId ?? userMessage.contextId ?? 'none'}`,
      `taskId=${effectiveTaskId}`,
    );
    // Extract the user's text message from the RequestContext
    const textParts = (userMessage.parts ?? []).filter(
      (p): p is TextPart => p.kind === 'text'
    );
    const userText = textParts.map((p) => p.text).join('\n');

    const answer = await this.agent.answerQuery(userText);
    logger.debug(`[PolicyAgentExecutor] Task ${effectiveTaskId} completed`);
    // 2. Create artifact: publish an artifact for this task
    const artifactUpdate: TaskArtifactUpdateEvent = {
      kind: 'artifact-update',
      taskId: effectiveTaskId,
      contextId: effectiveContextId,
      artifact: {
        artifactId: `artifact-${effectiveTaskId}`,
        name: 'result.txt',
        parts: [{ kind: 'text', text: answer }],
      },
    };
    eventBus.publish(artifactUpdate);

    // 3. Finish task: publish final status and signal completion
    const finalUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId: effectiveTaskId,
      contextId: effectiveContextId,
      status: {
        state: 'completed',
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(finalUpdate);
    eventBus.finished();
  }

  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    // Placeholder for cancellation support.
    return;
  }
}

initA2AServer({
  executor: new policyAgentTaskExecutor(),
  name: APP_NAME,
  agentCard: POLICY_AGENT_CARD,
  url: POLICY_AGENT_BASE_URL,
  port: POLICY_AGENT_PORT,
});
