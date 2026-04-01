import os
import sys
import uuid
from pathlib import Path
from ursa.cli.config import UrsaConfig, ModelConfig
from ursa.cli.hitl import HITL
from fastmcp import FastMCP

os.environ["OPENAI_API_KEY"] = "ollama"

config = UrsaConfig(
    workspace=Path("ursa_workspace"),
    thread_id=str(uuid.uuid4()),
    llm_model=ModelConfig(
        model="openai:llama3.1",
        base_url="http://localhost:11434/v1",
        api_key_env="OPENAI_API_KEY"
    )
)

hitl = HITL(config)

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

if __name__ == "__main__":
    mcp_app = hitl.as_mcp_server()
    print("🚀 Starting URSA MCP Server on http://localhost:8000/mcp")
    mcp_app.run(transport="streamable-http")