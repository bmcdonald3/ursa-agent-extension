import asyncio
import os
from pathlib import Path
from ursa.cli.config import UrsaConfig, ModelConfig
from ursa.cli.hitl import HITL

# 1. Force the correct configuration
os.environ["OPENAI_API_KEY"] = "ollama"

config = UrsaConfig(
    # Use a brand new workspace folder to guarantee NO old database history
    workspace=Path("fresh_workspace"),
    llm_model=ModelConfig(
        model="openai:qwen2.5-coder",
        base_url="http://localhost:11434/v1",
        api_key_env="OPENAI_API_KEY"
    )
)

async def main():
    print("🤖 Initializing URSA Execution Agent...")
    hitl = HITL(config)
    
    print("📝 Sending prompt: Write 'Test successful' to test_file.txt")
    # This calls the agent directly, bypassing MCP
    result = await hitl.run_agent(
        "execute", 
        "Write the text 'Test successful' to a file named test_file.txt in the current directory."
    )
    
    print("\n✅ AGENT RESULT:")
    print(result)

if __name__ == "__main__":
    asyncio.run(main())