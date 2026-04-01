import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { McpBridge } from '../../mcp';

describe('Direct Tool Execution Test', () => {
  let mcpBridge: McpBridge;
  const testFilePath = path.join(process.cwd(), 'integration-success.txt');
  const expectedContent = 'Cline verified this';

  before(async function() {
    this.timeout(30000);
    
    console.log('[DirectTest] Initializing MCP bridge...');
    mcpBridge = new McpBridge();
    
    // Connect with retry
    let retries = 5;
    while (retries > 0) {
      try {
        console.log(`[DirectTest] Connecting to URSA (attempt ${6-retries}/5)...`);
        await mcpBridge.connect('http://localhost:8000/mcp');
        console.log('[DirectTest] ✅ Connected');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  });

  after(async function() {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (mcpBridge) {
      await mcpBridge.disconnect();
    }
    
    try {
      const { execSync } = require('child_process');
      execSync('pkill -f "start_ursa.py"');
    } catch (e) {}
  });

  it('should directly execute tool to create file', async function() {
    this.timeout(30000);
    
    console.log('[DirectTest] Calling execute tool directly...');
    
    const result = await mcpBridge.callTool('execute', {
      prompt: `Write the text '${expectedContent}' to a file at ./integration-success.txt`
    });
    
    console.log('[DirectTest] Tool result:', result);
    
    // Wait for file operation
    await new Promise(r => setTimeout(r, 2000));
    
    // Verify file exists
    console.log('[DirectTest] Checking file:', testFilePath);
    assert.ok(fs.existsSync(testFilePath), 'File was not created');
    console.log('[DirectTest] ✅ File exists');
    
    // Verify content
    const content = fs.readFileSync(testFilePath, 'utf-8');
    console.log('[DirectTest] File content:', content);
    assert.ok(
      content.includes(expectedContent),
      `File should contain "${expectedContent}"`
    );
    console.log('[DirectTest] ✅ File content verified');
    console.log('[DirectTest] 🎉 TEST PASSED!');
  });
});