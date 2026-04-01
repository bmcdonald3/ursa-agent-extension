import os
import sys
from pathlib import Path
from ursa.cli.config import UrsaConfig, ModelConfig
from ursa.cli.hitl import HITL
from fastmcp import FastMCP

# 1. Force the working configuration from debug_llm.py
os.environ["OPENAI_API_KEY"] = "ollama"

config = UrsaConfig(
    workspace=Path("ursa_workspace"),
    llm_model=ModelConfig(
        model="openai:qwen2.5-coder",
        base_url="http://localhost:11434/v1",
        api_key_env="OPENAI_API_KEY"
    )
)

# 2. Initialize the HITL manager with the explicit config
hitl = HITL(config)

# 3. Patch as_mcp_server for FastMCP 3.2.0 compatibility
def fixed_as_mcp_server(self, **kwargs):
    from ursa import __version__ as ursa_version
    mcp = FastMCP("URSA", version=ursa_version, **kwargs)
    for name, agent in self.agents.items():
        mcp.tool(
            self._make_agent_tool(name),
            name=name,
            description=agent.description,
        )
    return mcp

import types
hitl.as_mcp_server = types.MethodType(fixed_as_mcp_server, hitl)

# 4. Start the MCP server
if __name__ == "__main__":
    mcp_app = hitl.as_mcp_server()
    print("🚀 Starting URSA MCP Server on http://localhost:8000/mcp")
    mcp_app.run(transport="streamable-http")