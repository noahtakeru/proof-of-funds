/**
 * Test script for direct-fix.js - ESM version
 */

console.log("Starting direct-fix test script (ESM)");

try {
    // Use dynamic import to load the module
    const directFixModule = await import('./cjs/direct-fix.cjs');
    console.log("Successfully loaded module via ESM dynamic import");

    // Run the main function
    await directFixModule.main();
    console.log("Main function completed successfully");
} catch (error) {
    console.error("Error running main function:", error);
}

console.log("Direct-fix test script completed"); 