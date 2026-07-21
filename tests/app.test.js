import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read index.html to setup mock DOM environment for each test
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

describe('Clipboardy App Test Suite (TDD)', () => {
    beforeEach(() => {
        // Setup JSDOM environment
        document.documentElement.innerHTML = html;
        
        // Reset Vitest module registry to reload app.js fresh
        vi.resetModules();
        
        // Mock global confirm dialog
        vi.stubGlobal('confirm', vi.fn(() => true));
    });

    it('1. should calculate word and character count correctly', async () => {
        const { countWordsAndChars } = await import('../app.js');
        
        // Check empty text
        expect(countWordsAndChars('')).toBe('0 words | 0 chars');
        
        // Check standard text
        expect(countWordsAndChars('Halo dunia')).toBe('2 words | 10 chars');
        
        expect(countWordsAndChars('  Banyak   spasi  ')).toBe('2 words | 18 chars');
    });

    it('2. should hash password using SHA-256', async () => {
        const { hashPassword } = await import('../app.js');
        
        const pwd = 'rahasia123';
        const hash = await hashPassword(pwd);
        
        expect(hash).toBeDefined();
        expect(hash.length).toBe(64); // SHA-256 produces 64 character hex string
        
        // Pre-computed hash of 'rahasia123'
        // sha256('rahasia123') = bee5688aea66a47460b19c76f8f199c6b9585eb726f8322b1429793863609ca2
        expect(hash).toBe('bee5688aea66a47460b19c76f8f199c6b9585eb726f8322b1429793863609ca2');
    });

    it('3. should start app in locked state and show auth screen', async () => {
        const { isAppLocked } = await import('../app.js');

        const authScreen = document.getElementById('authScreen');
        const appScreen = document.getElementById('appScreen');
        
        expect(isAppLocked).toBe(true);
        expect(authScreen.classList.contains('hidden')).toBe(false);
        expect(appScreen.classList.contains('hidden')).toBe(true);
    });

    it('4. should unlock app and transition screens upon successful login', async () => {
        // Import login function to trigger event bindings
        await import('../app.js');

        const passwordInput = document.getElementById('passwordInput');
        const loginBtn = document.getElementById('loginBtn');
        const authScreen = document.getElementById('authScreen');
        const appScreen = document.getElementById('appScreen');
        
        // Simulate password entry and click login
        passwordInput.value = 'rahasia123';
        
        // Trigger login
        loginBtn.click();

        // Wait for hashPassword promise and firestore initialization
        await new Promise(resolve => setTimeout(resolve, 100));

        // UI transitions should have occurred
        expect(authScreen.classList.contains('hidden')).toBe(true);
        expect(appScreen.classList.contains('hidden')).toBe(false);
    });

    it('5. should lock app and reset memory elements on lockApp call', async () => {
        const { lockApp } = await import('../app.js');

        // Execute lock
        lockApp();

        await new Promise(resolve => setTimeout(resolve, 150));

        const authScreen = document.getElementById('authScreen');
        const appScreen = document.getElementById('appScreen');

        expect(authScreen.classList.contains('hidden')).toBe(false);
        expect(appScreen.classList.contains('hidden')).toBe(true);
    });

    it('6. should check safeConfirm avoids lock trigger by setting ignoreBlur', async () => {
        const { safeConfirm } = await import('../app.js');
        
        const result = safeConfirm('Apakah Anda yakin?');
        expect(result).toBe(true);
        
        // It should set ignoreBlur = true during confirm dialog sequence
        const { ignoreBlur } = await import('../app.js');
        expect(ignoreBlur).toBe(true);
        
        // Wait for timeout to reset ignoreBlur to false
        await new Promise(resolve => setTimeout(resolve, 350));
        
        const { ignoreBlur: ignoreBlurAfter } = await import('../app.js');
        expect(ignoreBlurAfter).toBe(false);
    });
});
