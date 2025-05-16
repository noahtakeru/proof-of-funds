/**
 * Babel Configuration
 * 
 * This configuration is used for transpiling JavaScript code across the project.
 * It ensures compatibility with various environments and browsers.
 */

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: '18',
          browsers: [
            'last 2 Chrome versions',
            'last 2 Firefox versions',
            'last 2 Safari versions',
            'last 2 Edge versions'
          ]
        }
      }
    ]
  ],
  plugins: [
    // These plugins help with ES6+ features in older environments
    '@babel/plugin-transform-optional-chaining',
    '@babel/plugin-transform-nullish-coalescing-operator',
    
    // Fix module resolution issues
    ['module-resolver', {
      resolvePath(sourcePath, currentFile, opts) {
        // Handle specific library imports
        if (sourcePath === 'fs' && (currentFile.includes('fastfile') || currentFile.includes('snarkjs'))) {
          return 'browserify-fs';
        }
        return sourcePath;
      }
    }]
  ]
};