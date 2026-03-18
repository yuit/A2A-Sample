"""
Healthcare Concierge scaffold using BeeAI's RequirementAgent.

This file is intentionally a scaffold: it sets up the core RequirementAgent
structure and shows where to plug in additional tools (including your A2A
remote agents).
"""

import os
from typing import Final

try:
  import beeai_framework  # noqa: F401
  from beeai_framework.agents.requirement import RequirementAgent
  from beeai_framework.agents.requirement.requirements.conditional import (
    ConditionalRequirement,
  )
  from beeai_framework.backend import ChatModel
  from beeai_framework.adapters.gemini import GeminiChatModel
  from beeai_framework.tools.think import ThinkTool
except ModuleNotFoundError as e:
  raise ModuleNotFoundError(
    "beeai-framework is not installed in the current environment. "
    "Install it from `clients/` (and use Python >= 3.11) before running this file."
  ) from e


def build_requirement_agent() -> RequirementAgent:
  """
  Create a RequirementAgent with rule-based tool execution constraints.

  Replace the `tools` and `requirements` lists with your actual concierge
  workflow (e.g., call FindProviders via A2A, then decide next steps, etc.).
  """
  # Core tools (minimal scaffold).
  tools = [
    ThinkTool(),
  ]

  # Enforce that the model uses ThinkTool early to follow a predictable pattern.
  requirements = [
    ConditionalRequirement(ThinkTool, force_at_step=1),
  ]

  return RequirementAgent(
    # GeminiChatModel will load model and api key from the environment variables.
    llm=GeminiChatModel(),
    tools=tools,
    instructions=(
      "You are a Healthcare Concierge. "
      "Given a user's question, gather any missing context, then provide safe, "
      "helpful guidance and recommend appropriate next steps."
    ),
    requirements=requirements,
  )


async def main() -> None:
  """
  Minimal local smoke test.
  """
  agent = build_requirement_agent()
  response = await agent.run("I have anxiety and trouble sleeping. What should I do?")
  # BeeAI response shape can change; this keeps the scaffold resilient.
  print(getattr(response, "last_message", response).text if hasattr(response, "last_message") else response)


if __name__ == "__main__":
  import asyncio

  asyncio.run(main())

