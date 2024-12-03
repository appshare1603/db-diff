const fs = require('fs').promises;
const path = require('path');

const SNAPSHOTS_DIR = path.join(__dirname, '../../snapshots');

// Ensure snapshots directory exists
async function initStorage() {
    try {
        await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
    } catch (error) {
        console.error('Error initializing storage:', error);
        throw error;
    }
}

// Save a snapshot
async function saveSnapshot(snapshot) {
    try {
        const timestamp = new Date(snapshot.timestamp).getTime();
        const fileName = `snapshot_${timestamp}.json`;
        const filePath = path.join(SNAPSHOTS_DIR, fileName);
        
        await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2));
        return fileName;
    } catch (error) {
        console.error('Error saving snapshot:', error);
        throw error;
    }
}

// Load all snapshots
async function loadSnapshots() {
    try {
        const files = await fs.readdir(SNAPSHOTS_DIR);
        const snapshots = [];
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(SNAPSHOTS_DIR, file);
                const content = await fs.readFile(filePath, 'utf8');
                snapshots.push(JSON.parse(content));
            }
        }
        
        // Sort snapshots by timestamp (newest first)
        return snapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('Error loading snapshots:', error);
        throw error;
    }
}

// Delete a snapshot
async function deleteSnapshot(timestamp) {
    try {
        const fileName = `snapshot_${new Date(timestamp).getTime()}.json`;
        const filePath = path.join(SNAPSHOTS_DIR, fileName);
        await fs.unlink(filePath);
    } catch (error) {
        console.error('Error deleting snapshot:', error);
        throw error;
    }
}

module.exports = {
    initStorage,
    saveSnapshot,
    loadSnapshots,
    deleteSnapshot
};
