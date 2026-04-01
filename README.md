## Project Goal:
To build a VS Code extension that natively replicates the "Cline" autonomous developer experience, leveraging a robust Python backend for system operations.

## The Architecture:
This project bridges distinct systems to create a closed-loop AI agent:

* **The Extension (The Brain & Eyes):** A custom VS Code extension providing the UI, chat interface, and Orchestrator. It connects to an LLM (local or cloud) to process user requests, intercepts JSON-formatted tool calls, and presents the user with an Approval Card before execution.
* **FastMCP Server (The Hands):** A Python-based server exposing direct system operations (writing files, running bash commands) via the Model Context Protocol (MCP).
* **The Communication Layer:** The extension's `McpBridge` securely passes approved JSON payloads to the Python server for instant, hallucination-free execution.

## Current Status:
**Phase 1 Complete:** The core execution loop is fully functional. The Orchestrator successfully catches LLM-generated tool payloads, renders approval cards in the UI, and executes raw Python tools via FastMCP. 

We are currently running a "Direct Tool" architecture (bypassing URSA's internal LangGraph swarm) to guarantee execution stability and eliminate text-to-tool degradation from local models.

## Next Steps:
1. Parse the MCP JSON return payloads in the UI to display clean success/error strings.
2. Expand the Python FastMCP server to include `read_file`, `list_directory`, and `delete_file`.
3. Evaluate whether to maintain the Direct Tool architecture or re-attempt integration with LANL URSA's multi-agent swarm framework.