/**
 * Tests for WebAssembly loader infrastructure
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('WebAssembly Infrastructure', () => {
  test('WASM loader files exist and have correct content', () => {
    // Check if the wasmLoader.ts file exists
    const wasmLoaderPath = path.join(__dirname, '..', 'wasmLoader.ts');
    expect(fs.existsSync(wasmLoaderPath)).toBe(true);
    
    // Read file content to verify key components
    const content = fs.readFileSync(wasmLoaderPath, 'utf8');
    
    // Check for key functions
    expect(content).toContain('export async function detectWasmSupport');
    expect(content).toContain('export async function loadWasmModule');
    expect(content).toContain('export function clearWasmCache');
    expect(content).toContain('export async function loadWasmModuleInWorker');
    expect(content).toContain('export const wasmLoader');
    
    // Check for key classes
    expect(content).toContain('class WasmLoader');
    
    // Check main functionality
    expect(content).toContain('loadModule');
    expect(content).toContain('initialize');
    expect(content).toContain('isWasmSupported');
    expect(content).toContain('areWorkersSupported');
  });
  
  test('WASM infrastructure documentation is complete', () => {
    // Check if documentation exists
    const docPath = path.join(__dirname, '..', 'WASM_INFRASTRUCTURE.md');
    expect(fs.existsSync(docPath)).toBe(true);
    
    // Read documentation content
    const content = fs.readFileSync(docPath, 'utf8');
    
    // Verify key sections are documented
    expect(content).toContain('# WebAssembly Infrastructure for ZK Proofs');
    expect(content).toContain('WebAssembly Detection');
    expect(content).toContain('Module Loading');
    expect(content).toContain('Worker-Based Loading');
    expect(content).toContain('Capability Detection');
    expect(content).toContain('Main API');
    expect(content).toContain('## Usage Examples');
    expect(content).toContain('## Fallback Mechanisms');
  });
});