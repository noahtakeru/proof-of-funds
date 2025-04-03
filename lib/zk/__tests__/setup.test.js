/**
 * Basic test to verify the development environment setup
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Development Environment Setup', () => {
  test('Basic environment test', () => {
    // This test simply verifies that the test environment is working
    expect(true).toBe(true);
  });

  test('Project structure exists', () => {
    // Check if key directories exist
    const baseDir = join(__dirname, '..');
    
    // Check key directories
    expect(fs.existsSync(join(baseDir, 'circuits'))).toBe(true);
    expect(fs.existsSync(join(baseDir, 'scripts'))).toBe(true);
    
    // Check key files
    expect(fs.existsSync(join(baseDir, 'types.ts'))).toBe(true);
    expect(fs.existsSync(join(baseDir, 'circuitVersions.ts'))).toBe(true);
    expect(fs.existsSync(join(baseDir, 'wasmLoader.ts'))).toBe(true);
    expect(fs.existsSync(join(baseDir, 'snarkjsLoader.ts'))).toBe(true);
  });
  
  test('Basic file content verification', () => {
    const baseDir = join(__dirname, '..');
    const typesContent = fs.readFileSync(join(baseDir, 'types.ts'), 'utf8');
    
    // Just check for some key strings that should be in these files
    expect(typesContent).toContain('export interface');
    
    const circuitVersionsContent = fs.readFileSync(join(baseDir, 'circuitVersions.ts'), 'utf8');
    expect(circuitVersionsContent).toContain('CircuitVersionRegistry');
  });
});