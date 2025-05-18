/**
 * File System shim for browser compatibility
 * 
 * This provides a simple interface that works in both browser and server environments.
 * In the browser, we cannot access the filesystem directly, so we provide a fallback
 * that uses the fetch API to load files from the public directory.
 */

const isServer = typeof window === 'undefined';

// In server environment, use real fs
let fsImplementation = null;
let fsPromisesImplementation = null;
let pathImplementation = null;

if (isServer) {
  fsImplementation = require('fs');
  fsPromisesImplementation = require('fs').promises;
  pathImplementation = require('path');
} else {
  // Browser fallbacks
  fsImplementation = {
    // Check if a file exists in the public directory
    existsSync: (filePath) => {
      // Always return false in browser since we can't check synchronously
      console.warn(`Browser can't synchronously check if file exists: ${filePath}`);
      return false;
    },
    
    // Read a file synchronously from the public directory
    readFileSync: (filePath, encoding) => {
      console.warn(`Browser can't synchronously read file: ${filePath}`);
      throw new Error('Cannot synchronously read files in browser environment');
    }
  };
  
  fsPromisesImplementation = {
    // Check if a file exists in the public directory
    access: async (filePath) => {
      try {
        // Convert the file path to a URL relative to the public directory
        const publicPath = filePath.replace(/^.*\/public\//, '/');
        const response = await fetch(publicPath, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`File not found: ${publicPath}`);
        }
      } catch (error) {
        throw new Error(`Cannot access file in browser: ${filePath}`);
      }
    },
    
    // Read a file from the public directory
    readFile: async (filePath, encoding) => {
      try {
        // Convert the file path to a URL relative to the public directory
        const publicPath = filePath.replace(/^.*\/public\//, '/');
        const response = await fetch(publicPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${publicPath}`);
        }
        
        if (encoding === 'utf8' || typeof encoding === 'string') {
          return await response.text();
        } else {
          return new Uint8Array(await response.arrayBuffer());
        }
      } catch (error) {
        throw new Error(`Cannot read file in browser: ${filePath}`);
      }
    }
  };
  
  pathImplementation = {
    join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
    resolve: (...parts) => parts.join('/').replace(/\/+/g, '/'),
  };
}

module.exports = {
  fs: fsImplementation,
  promises: fsPromisesImplementation,
  path: pathImplementation
};