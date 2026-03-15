import dotenv from 'dotenv';
import { AgentCard } from '@a2a-js/sdk';
import type { AgentExecutor } from '@a2a-js/sdk/server';
import { initA2AServer } from './utils.js';
import {
  LlmAgent,
  A2AAgentExecutor,
  GOOGLE_SEARCH,
  InMemorySessionService,
  InMemoryMemoryService,
  InMemoryArtifactService,
} from 'adk/core';
// Load configuration from .env at project root
dotenv.config();

const GOOGLE_GENAI_MODEL = process.env.GOOGLE_GENAI_MODEL ?? 'gemini-3-pro-preview';

const ROOT_RESEARCH_AGENT = new LlmAgent({
  model: GOOGLE_GENAI_MODEL,
  name: "HealthResearchAgent",
  tools: [GOOGLE_SEARCH],
  description: `Provides healthcare information about symptoms, health
    conditions, treatments, and procedures using up-to-date web resources.`,
  instruction: `You are a healthcare research agent tasked with 
    providing information about health conditions. Use the google_search 
    tool to find information on the web about options, symptoms, treatments, 
    and procedures. Cite your sources in your responses. Output all of the 
    information you find.`
});

const RESEARCH_AGENT_BASE_URL = `http://localhost:${process.env.RESEARCH_AGENT_PORT}`;
const RESEARCH_AGENT_CARD: AgentCard = {
  name: 'Research Agent',
  description: 'Provides healthcare information using Google Search.',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: RESEARCH_AGENT_BASE_URL,
  skills: [{ id: 'research', name: 'Research', description: 'Research health topics', tags: ['research', 'health'] }],
  capabilities: { pushNotifications: false },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  additionalInterfaces: [
    { url: `${RESEARCH_AGENT_BASE_URL}/a2a/jsonrpc`, transport: 'JSONRPC' },
    { url: `${RESEARCH_AGENT_BASE_URL}/a2a/rest`, transport: 'HTTP+JSON' },
  ],
};

const RESEARCH_A2A_AGENT_EXECUTOR = new A2AAgentExecutor({
  runner: {
    agent: ROOT_RESEARCH_AGENT,
    appName: "RESEARCH_AGENT",
    sessionService: new InMemorySessionService(),
    memoryService: new InMemoryMemoryService(),
    artifactService: new InMemoryArtifactService(),
  }
});

initA2AServer({
  executor: RESEARCH_A2A_AGENT_EXECUTOR as AgentExecutor,
  name: 'Research Agent',
  agentCard: RESEARCH_AGENT_CARD,
  url: RESEARCH_AGENT_BASE_URL,
  port: process.env.RESEARCH_AGENT_PORT,
});