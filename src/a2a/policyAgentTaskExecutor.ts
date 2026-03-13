import { Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent, TextPart } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import { policyAgent } from '../policyAgent';
/**
 * A2A AgentExecutor that returns a Task: init task, create artifact, then finish task.
 */
export class policyAgentTaskExecutor implements AgentExecutor {
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
    
    // Extract the user's text message from the RequestContext
    const textParts = (userMessage.parts ?? []).filter(
      (p): p is TextPart => p.kind === 'text'
    );
    const userText = textParts.map((p) => p.text).join('\n');

    const answer = await this.agent.answerQuery(userText);

    // 2. Create artifact: publish an artifact for this task
    const artifactUpdate: TaskArtifactUpdateEvent = {
      kind: 'artifact-update',
      taskId: effectiveTaskId,
      contextId: effectiveContextId,
      artifact: {
        artifactId: `artifact-${effectiveTaskId}`,
        name: 'result.txt',
        parts: [{ kind: 'text', text: `Task ${effectiveTaskId} completed. \n\n Here is the answer ${answer}` }],
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