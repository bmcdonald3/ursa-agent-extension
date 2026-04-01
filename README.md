## Project Goal:
To build a VS Code extension that natively replicates the "Cline" autonomous developer experience, but powered by the LANL URSA (Universal Reconfigurable Swarm Agents) framework.

## The Architecture:
This project bridges three distinct systems to create a closed-loop AI agent:

The Extension (The Eyes & Ears): A custom VS Code extension providing the UI, chat interface, and Orchestrator. It listens to the LLM's text output, intercepts JSON-formatted tool calls, and presents the user with an Approval Card before execution.

URSA via MCP (The Hands): The Los Alamos National Lab URSA framework, exposed via a FastMCP server. URSA handles the actual system execution (e.g., writing files, running bash commands, analyzing data) using its suite of built-in tools.

Local LLM (The Brain): A locally hosted model (like qwen2.5-coder running on Ollama) that powers URSA's internal reasoning loop, avoiding the need for paid cloud APIs for standard tool execution.

## Current Status:
The Extension UI and Orchestrator successfully generate tool calls and render approval cards. The MCP connection to URSA is established. We are currently resolving the final link: ensuring URSA's internal execute agent correctly routes its reasoning queries to the local Ollama instance via the OpenAI-compatible /v1 endpoint.