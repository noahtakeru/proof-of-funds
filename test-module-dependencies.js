/**
 * Module Dependency Analyzer
 * 
 * This script analyzes the dependencies between modules to help identify potential
 * circular dependencies and visualize the module structure.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname);
const ZK_SRC_DIR = path.join(PROJECT_ROOT, 'lib/zk/src');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'module-dependencies.md');

// Track dependencies
const dependencies = {};
const potentialCircularDeps = [];

/**
 * Parse import statements from a file
 * @param {string} filePath - Path to the file
 * @returns {Array<string>} Array of imported modules
 */
function parseImports(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = [];
    
    // Match ESM imports
    const esmImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = esmImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Match CommonJS requires
    const cjsRequireRegex = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = cjsRequireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  } catch (error) {
    console.error(`Error parsing imports from ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Resolve a relative import path to its absolute path
 * @param {string} importPath - The import path
 * @param {string} importerPath - The path of the file doing the importing
 * @returns {string} Resolved absolute path
 */
function resolveImportPath(importPath, importerPath) {
  // Handle relative imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    // Resolve the import path relative to the importer's directory
    const importerDir = path.dirname(importerPath);
    
    // Handle various file extensions
    let resolvedPath = path.resolve(importerDir, importPath);
    
    // Check for various extensions
    const extensions = ['.js', '.mjs', '.cjs', '.ts', '.tsx'];
    
    // If the import path already has an extension, use it directly
    if (extensions.some(ext => importPath.endsWith(ext))) {
      return resolvedPath;
    }
    
    // Otherwise, check for various extensions
    for (const ext of extensions) {
      if (fs.existsSync(resolvedPath + ext)) {
        return resolvedPath + ext;
      }
    }
    
    // If no matching file found, return the original resolved path
    return resolvedPath;
  }
  
  // For non-relative imports (e.g. npm packages), return as is
  return importPath;
}

/**
 * Check for potential circular dependencies in a module
 * @param {string} modulePath - Path to the module
 * @param {Set<string>} visitedPaths - Set of already visited paths
 * @param {Array<string>} importChain - Chain of imports leading to this module
 */
function checkCircularDeps(modulePath, visitedPaths = new Set(), importChain = []) {
  if (visitedPaths.has(modulePath)) {
    // Found a potential circular dependency
    const cycle = [...importChain, modulePath];
    potentialCircularDeps.push(cycle);
    return;
  }
  
  // Add current module to visited paths
  visitedPaths.add(modulePath);
  importChain.push(modulePath);
  
  // Get dependencies of this module
  const deps = dependencies[modulePath] || [];
  
  // Check each dependency for circular references
  for (const dep of deps) {
    checkCircularDeps(dep, new Set(visitedPaths), [...importChain]);
  }
}

/**
 * Generate a dependency graph visualization in Markdown format
 * @returns {string} Markdown text of dependency graph
 */
function generateDependencyGraph() {
  let markdown = '# Module Dependency Analysis\n\n';
  
  // Add summary of modules
  markdown += `## Summary\n\n`;
  markdown += `- Total modules analyzed: ${Object.keys(dependencies).length}\n`;
  markdown += `- Potential circular dependencies found: ${potentialCircularDeps.length}\n\n`;
  
  // Add section for potential circular dependencies
  if (potentialCircularDeps.length > 0) {
    markdown += `## Potential Circular Dependencies\n\n`;
    
    potentialCircularDeps.forEach((cycle, index) => {
      markdown += `### Circular Dependency ${index + 1}\n\n`;
      
      // Create a more readable cycle representation
      const cyclePath = cycle.map(path => {
        // Get the relative path from the project root
        return path.replace(PROJECT_ROOT, '').replace(/\\/g, '/');
      });
      
      // Add cycle visualization
      markdown += '```\n';
      cyclePath.forEach((mod, i) => {
        if (i < cyclePath.length - 1) {
          markdown += `${mod} →\n`;
        } else {
          markdown += `${mod}\n`;
        }
      });
      markdown += '```\n\n';
    });
  }
  
  // Add direct dependencies section
  markdown += `## Module Dependencies\n\n`;
  
  // Sort modules by path for easier reading
  const sortedModules = Object.keys(dependencies).sort();
  
  sortedModules.forEach(modulePath => {
    const relativePath = modulePath.replace(PROJECT_ROOT, '').replace(/\\/g, '/');
    markdown += `### ${relativePath}\n\n`;
    
    const deps = dependencies[modulePath];
    if (deps.length === 0) {
      markdown += `*No dependencies*\n\n`;
    } else {
      markdown += `Dependencies:\n\n`;
      deps.forEach(dep => {
        const relDep = dep.replace(PROJECT_ROOT, '').replace(/\\/g, '/');
        markdown += `- ${relDep}\n`;
      });
      markdown += '\n';
    }
  });
  
  return markdown;
}

/**
 * Main function to analyze module dependencies
 */
function analyzeModuleDependencies() {
  console.log('Analyzing module dependencies...');
  
  // Create a list of files to analyze
  const filesToAnalyze = [];
  
  // Helper function to recursively find files
  function findFiles(dirPath) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other special directories
        if (file !== 'node_modules' && file !== '.git') {
          findFiles(filePath);
        }
      } else if (stat.isFile()) {
        // Check if it's a JS, TS, or related file
        if (/\.(js|mjs|cjs|ts|tsx)$/.test(file)) {
          filesToAnalyze.push(filePath);
        }
      }
    }
  }
  
  // Find JS and TS files in the lib/zk/src directory
  findFiles(ZK_SRC_DIR);
  
  console.log(`Found ${filesToAnalyze.length} files to analyze`);
  
  // Parse dependencies for each file
  for (const filePath of filesToAnalyze) {
    const imports = parseImports(filePath);
    
    // Resolve import paths to absolute paths
    const resolvedImports = imports
      .map(importPath => resolveImportPath(importPath, filePath))
      .filter(importPath => filesToAnalyze.includes(importPath));
    
    // Store dependencies
    dependencies[filePath] = resolvedImports;
  }
  
  // Check for circular dependencies
  for (const modulePath of Object.keys(dependencies)) {
    checkCircularDeps(modulePath);
  }
  
  // Generate dependency graph Markdown
  const markdown = generateDependencyGraph();
  
  // Write to file
  fs.writeFileSync(OUTPUT_FILE, markdown);
  
  console.log(`Dependency analysis complete. Results written to ${OUTPUT_FILE}`);
  console.log(`Found ${potentialCircularDeps.length} potential circular dependencies`);
}

// Run the analysis
analyzeModuleDependencies();