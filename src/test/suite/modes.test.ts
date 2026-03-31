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

    test('Orchestrator should NOT call execute tool when in Plan mode', async () => {
        // Mock a model that tries to call the 'execute' tool despite being in Plan mode
        const rogueModelResponse = {
            content: "I will now run the code.",
            toolCalls: [
                {
                    id: 'call_execute',
                    function: {
                        name: 'execute',
                        arguments: JSON.stringify({ command: 'rm -rf /' })
                    }
                }
            ]
        };
        sinon.stub(llmClient, 'complete').resolves(rogueModelResponse);
        const mcpSpy = sinon.spy(mcpBridge, 'callTool');

        try {
            await orchestrator.processPrompt("Delete my files", "plan");
        } catch (e) {
            // We expect an error or a graceful block
        }

        // Verify the MCP bridge was never actually told to execute
        const executeCalls = mcpSpy.getCalls().filter(c => c.args[0] === 'execute');
        assert.strictEqual(executeCalls.length, 0, "Execute tool was called while in Plan mode!");
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
        const mcpStub = sinon.stub(mcpBridge, 'callTool').resolves({ result: 'plan created' });

        await orchestrator.processPrompt("Give me a plan", "plan");

        assert.ok(mcpStub.calledWith('plan', sinon.match.any));
    });

    test('Orchestrator should call write_to_file tool when asked to create a file in ACT mode', async () => {
        let firstCall = true;
        const completeStub = sinon.stub(llmClient, 'complete').callsFake(async (params: any) => {
            if (firstCall) {
                firstCall = false;
                return {
                    content: '',
                    toolCalls: [
                        {
                            id: 'call_write',
                            function: {
                                name: 'write_to_file',
                                arguments: JSON.stringify({
                                    path: 'index.html',
                                    content: '<html></html>'
                                })
                            }
                        }
                    ]
                };
            }
            return {
                content: 'I have created index.html with the basic HTML structure.',
                toolCalls: []
            };
        });

        const mcpStub = sinon.stub(mcpBridge, 'callTool').resolves({ result: 'File created successfully' });

        const response = await orchestrator.processPrompt('Create an index.html file', 'act');

        // Verify the tool was called
        assert.ok(mcpStub.calledWith('write_to_file', sinon.match.any), 'write_to_file should have been called');
        const callArgs = mcpStub.getCall(0).args[1];
        assert.strictEqual(callArgs.path, 'index.html', 'Path should be index.html');
        assert.strictEqual(callArgs.content, '<html></html>', 'Content should match');
        assert.ok(response.includes('created'), 'Response should mention file creation');
    });
});
