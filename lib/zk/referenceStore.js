/**
 * Reference ID Storage Module
 * 
 * Stores and retrieves reference IDs and their associated metadata
 */

// In-memory reference store (would be replaced by database in production)
const referenceStore = new Map();

/**
 * Stores a reference ID with metadata
 * 
 * @param {string} referenceId - The reference ID
 * @param {Object} metadata - Metadata for the proof
 * @returns {boolean} Success status
 */
export function storeReferenceId(referenceId, metadata) {
    try {
        // Don't overwrite existing references
        if (referenceStore.has(referenceId)) {
            console.error('Reference ID already exists');
            return false;
        }

        // Store the reference with timestamp
        referenceStore.set(referenceId, {
            ...metadata,
            createdAt: metadata.createdAt || Date.now(),
        });

        // Also save to localStorage for persistence
        const storedRefs = JSON.parse(localStorage.getItem('zk-references') || '{}');
        storedRefs[referenceId] = {
            ...metadata,
            createdAt: metadata.createdAt || Date.now(),
        };
        localStorage.setItem('zk-references', JSON.stringify(storedRefs));

        return true;
    } catch (error) {
        console.error('Error storing reference ID:', error);
        return false;
    }
}

/**
 * Retrieves metadata for a reference ID
 * 
 * @param {string} referenceId - The reference ID
 * @returns {Object|null} The metadata or null if not found
 */
export function getReference(referenceId) {
    // First check in-memory store
    if (referenceStore.has(referenceId)) {
        return referenceStore.get(referenceId);
    }

    // If not in memory, check localStorage
    try {
        const storedRefs = JSON.parse(localStorage.getItem('zk-references') || '{}');
        if (storedRefs[referenceId]) {
            // Add to in-memory store for future lookups
            referenceStore.set(referenceId, storedRefs[referenceId]);
            return storedRefs[referenceId];
        }
    } catch (error) {
        console.error('Error retrieving reference from storage:', error);
    }

    return null;
}

/**
 * Lists all stored reference IDs
 * 
 * @returns {Array<Object>} Array of reference ID objects with metadata
 */
export function listReferences() {
    try {
        const storedRefs = JSON.parse(localStorage.getItem('zk-references') || '{}');

        return Object.entries(storedRefs).map(([id, metadata]) => ({
            referenceId: id,
            ...metadata
        }));
    } catch (error) {
        console.error('Error listing references:', error);
        return [];
    }
}

/**
 * Deletes a reference ID
 * 
 * @param {string} referenceId - The reference ID to delete
 * @returns {boolean} Success status
 */
export function deleteReference(referenceId) {
    try {
        // Remove from in-memory store
        referenceStore.delete(referenceId);

        // Remove from localStorage
        const storedRefs = JSON.parse(localStorage.getItem('zk-references') || '{}');
        delete storedRefs[referenceId];
        localStorage.setItem('zk-references', JSON.stringify(storedRefs));

        return true;
    } catch (error) {
        console.error('Error deleting reference:', error);
        return false;
    }
}

export default {
    storeReferenceId,
    getReference,
    listReferences,
    deleteReference
};