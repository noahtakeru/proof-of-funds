/**
 * Test script for fix-all-modules.js - ESM version
 */

console.log("Starting fix-all-modules test script (ESM)");

try {
    // Use dynamic import to load the module
    const fixAllModulesModule = await import('./cjs/fix-all-modules.cjs');
    console.log("Successfully loaded module via ESM dynamic import");

    // Run the fixAllModules function
    const result = await fixAllModulesModule.fixAllModules({ quiet: false });
    console.log("fixAllModules function completed with result:", result);
} catch (error) {
    console.error("Error running fixAllModules function:", error);
}

console.log("Fix-all-modules test script completed"); 