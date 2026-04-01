import * as assert from 'assert';
import * as sinon from 'sinon';
import { Orchestrator } from '../../orchestrator';
import { McpBridge } from '../../mcp';
import { LLMClient } from '../../llmClient';

suite('Plan/Act Mode Constraints Test Suite', () => {
    let orchestrator: Orchestrator;
    let mcpBridge: McpBridge;
    let llmClient: LLMClient;

    setup(() => {
        llmClient = new LLMClient('test_key', 'https://openrouter.ai/api/v1');
        mcpBridge = new McpBridge();
        orchestrator = new Orchestrator(llmClient, mcpBridge, 'test-model');
    });

    test('Orchestrator allows planning tools when in Plan mode', async () => {
        const planResponse = {
            content: "Here is the plan.",
            toolCalls: [
                {
                    id: 'call_plan',
                    function: {
                        name: 'plan',
                        arguments: JSON.stringify({ task: 'test' })
                    }
                }
            ]
        };
        sinon.stub(llmClient, 'complete').resolves(planResponse);
        // Fixed: Added toolResult and content to match MCP SDK structure
        const mcpStub = sinon.stub(mcpBridge, 'callTool').resolves({ 
          toolResult: { result: 'plan created' }, 
          content: [{ type: 'text', text: 'plan created' }] 
        });

        await orchestrator.processPrompt("Give me a plan", "plan");
        assert.ok(mcpStub.calledWith('plan', sinon.match.any));
    });

    test('Orchestrator should call write_to_file tool when asked to create a file in ACT mode', async () => {
        let firstCall = true;
        sinon.stub(llmClient, 'complete').callsFake(async () => {
            if (firstCall) {
                firstCall = false;
                return {
                    content: '',
                    toolCalls: [{ id: 'call_write', function: { name: 'write_to_file', arguments: JSON.stringify({ path: 'index.html', content: '<html></html>' }) } }]
                };
            }
            return { content: 'I have created index.html', toolCalls: [] };
        });

        // Fixed: Renamed to mcpStub and updated result structure
        const mcpStub = sinon.stub(mcpBridge, 'callTool').resolves({ 
           toolResult: { result: 'File created successfully' }, 
           content: [{ type: 'text', text: 'File created successfully' }] 
        });

        const response = await orchestrator.processPrompt('Create an index.html file', 'act');

        assert.ok(mcpStub.calledWith('write_to_file', sinon.match.any), 'write_to_file should have been called');
        const callArgs = mcpStub.getCall(0).args[1];
        assert.strictEqual(callArgs.path, 'index.html');
        assert.ok(response.includes('created'));
    });
});