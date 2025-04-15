/**
 * @fileoverview ResourceMonitor ESM wrapper
 * 
 * This module provides ES Module exports for the ResourceMonitor class.
 * It serves as a compatibility layer for modern JavaScript environments
 * while maintaining backward compatibility with projects using CommonJS.
 */

import { ResourceMonitor } from './ResourceMonitor.ts';

// ESM exports
export { ResourceMonitor };
export default ResourceMonitor;