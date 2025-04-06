#!/usr/bin/env node

/**
 * Script to create clean circuit files with proper line endings
 */

const fs = require('fs');
const path = require('path');

const CIRCUITS_DIR = path.join(__dirname, '..', 'circuits');
const CLEAN_CIRCUITS_DIR = path.join(__dirname, '..', 'circuits-clean');

// Ensure clean circuits directory exists
if (!fs.existsSync(CLEAN_CIRCUITS_DIR)) {
  fs.mkdirSync(CLEAN_CIRCUITS_DIR, { recursive: true });
}

// Circuit names
const circuitNames = ['standardProof', 'thresholdProof', 'maximumProof'];

// Process each circuit
for (const circuitName of circuitNames) {
  const sourcePath = path.join(CIRCUITS_DIR, `${circuitName}.circom`);
  const destPath = path.join(CLEAN_CIRCUITS_DIR, `${circuitName}.circom`);
  
  try {
    // Read the original file
    const content = fs.readFileSync(sourcePath, 'utf8');
    
    // Create a clean version
    let cleanContent = '';
    
    // Add pragma statement as the first non-comment line
    cleanContent += '/*\n';
    cleanContent += ' * Clean version of the circuit file for compilation\n';
    cleanContent += ' */\n\n';
    cleanContent += 'pragma circom 2.0.0;\n\n';
    
    // Add includes from the original file
    const includeLines = content.match(/include\s+"[^"]+";/g) || [];
    for (const includeLine of includeLines) {
      cleanContent += includeLine + '\n';
    }
    cleanContent += '\n';
    
    // Add the rest of the content, skipping includes and potential pragma
    const contentLines = content.split('\n');
    let inComment = false;
    
    for (const line of contentLines) {
      // Skip include lines (we've already added them)
      if (line.match(/^\s*include\s+"[^"]+";/)) {
        continue;
      }
      
      // Skip pragma lines
      if (line.match(/^\s*pragma\s+/)) {
        continue;
      }
      
      // Track comment blocks to ensure we don't skip code inside them
      if (line.includes('/*')) {
        inComment = true;
      }
      
      if (inComment) {
        if (line.includes('*/')) {
          inComment = false;
        }
        continue; // Skip comment lines
      }
      
      // Add the line to clean content
      cleanContent += line + '\n';
    }
    
    // Write the clean file
    fs.writeFileSync(destPath, cleanContent);
    console.log(`Created clean version of ${circuitName} at ${destPath}`);
  } catch (error) {
    console.error(`Error processing ${circuitName}:`, error);
  }
}

console.log('Clean circuit files created successfully.');