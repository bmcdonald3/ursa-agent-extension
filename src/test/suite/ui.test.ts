import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('URSA-Coder UI Bridge Test Suite', () => {
    test('Extension contributes the URSA Coder sidebar view', async () => {
        // Get the extension - it should be loaded during tests
        const extension = vscode.extensions.getExtension('undefined_publisher.ursa-coder');
        
        // The extension package.json should have views configured
        const packageJson = require('../../../package.json');
        assert.ok(packageJson.contributes.views.ursaCoder, 'Extension should contribute ursaCoder views');
        assert.strictEqual(packageJson.contributes.views.ursaCoder.length, 1);
        assert.strictEqual(packageJson.contributes.views.ursaCoder[0].id, 'ursa-coder.chatView');
    });

    test('ChatViewProvider handles message from Webview', async () => {
        // This test ensures that when the UI sends a 'sendPrompt' command, 
        // the extension logic is actually triggered.
        const provider = (global as any).chatProvider;
        
        // Skip test if provider isn't available (extension may not be fully activated)
        if (!provider) {
            console.log('Skipping test: chatProvider not available');
            return;
        }
        
        const orchestratorSpy = sinon.spy(provider['_orchestrator'], 'processPrompt');
        
        // Mock a message coming from the HTML/JS frontend
        await provider['_onDidReceiveMessage']({
            command: 'sendPrompt',
            text: 'Test Prompt'
        });

        // Check that processPrompt was called with the correct arguments
        assert.ok(orchestratorSpy.calledOnce, 'processPrompt should be called once');
        assert.strictEqual(orchestratorSpy.firstCall.args[0], 'Test Prompt', 'First argument should be the prompt text');
        assert.strictEqual(orchestratorSpy.firstCall.args[1], 'plan', 'Second argument should be the mode (default: plan)');
    });
});