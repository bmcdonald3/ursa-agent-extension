import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { LLMClient } from '../../llmClient';
import { McpBridge } from '../../mcp';
import { Orchestrator } from '../../orchestrator';

describe('Act Mode Integration Test', () => {
  let orchestrator: Orchestrator;
  let mcpBridge: McpBridge;
  let llmClient: LLMClient;
  const testFilePath = path.join(process.cwd(), 'integration-success.txt');
  const expectedContent = 'Cline verified this';

  before(async function() {
    this.timeout(30000); // 30 second timeout for setup
    
    console.log('[Test] Initializing components...');
    
    // Initialize LLM client (using Ollama)
    llmClient = new LLMClient(
      'ollama',
      'http://localhost:11434/v1',
      {}
    );
    
    // Initialize MCP bridge
    mcpBridge = new McpBridge();
    
    // Connect to URSA server with retry logic
    let retries = 10;
    let connected = false;
    
    while (retries > 0 && !connected) {
      try {
        console.log(`[Test] Attempting to connect to URSA server (${11 - retries}/10)...`);
        await mcpBridge.connect('http://localhost:8000/mcp');
        connected = true;
        console.log('[Test] ✅ Connected to URSA server');
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to URSA server after 10 attempts: ${error}`);
        }
        console.log(`[Test] Connection failed, retrying in 2s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Initialize orchestrator with qwen2.5-coder model
    orchestrator = new Orchestrator(
      llmClient,
      mcpBridge,
      'qwen2.5-coder:7b'
    );
    
    // Enable autonomous mode for testing
    orchestrator.setAutonomousMode(true);
    
    console.log('[Test] Setup complete');
  });

  after(async function() {
    // Cleanup: remove test file if it exists
    if (fs.existsSync(testFilePath)) {
      console.log('[Test] Cleaning up test file...');
      fs.unlinkSync(testFilePath);
    }
    
    // Disconnect MCP bridge
    if (mcpBridge) {
      try {
        await mcpBridge.disconnect();
      } catch (e) {
        console.log('[Test] Error disconnecting:', e);
      }
    }
    
    // Kill URSA Python process
    console.log('[Test] Killing URSA server process...');
    try {
      const { execSync } = require('child_process');
      execSync('pkill -f "start_ursa.py"');
      console.log('[Test] URSA server process killed');
    } catch (e) {
      console.log('[Test] Error killing URSA process (may already be dead):', e);
    }
  });

  it('should create file via URSA MCP bridge autonomously', async function() {
    this.timeout(60000); // 60 second timeout for the test
    
    console.log('[Test] Sending prompt to orchestrator...');
    
    const prompt = `Create a file at ./integration-success.txt with content '${expectedContent}'`;
    
    try {
      const response = await orchestrator.processPrompt(prompt, 'act');
      
      console.log('[Test] Orchestrator response:', response);
      
      // Wait a moment for file system operations to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify file exists
      console.log('[Test] Checking if file exists:', testFilePath);
      assert.ok(
        fs.existsSync(testFilePath),
        `File ${testFilePath} was not created`
      );
      console.log('[Test] ✅ File exists');
      
      // Verify file content
      const actualContent = fs.readFileSync(testFilePath, 'utf-8');
      console.log('[Test] File content:', actualContent);
      
      assert.strictEqual(
        actualContent.trim(),
        expectedContent,
        `File content mismatch. Expected: "${expectedContent}", Actual: "${actualContent}"`
      );
      console.log('[Test] ✅ File content matches');
      
      console.log('[Test] 🎉 Integration test PASSED!');
      
    } catch (error) {
      console.error('[Test] ❌ Test failed:', error);
      throw error;
    }
  });
});