require('dotenv').config();
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { compareSnapshots } = require('./services/dbCompare');
const { takeSnapshot, testConnection, getTables } = require('./services/dbSnapshot');
const { initStorage, saveSnapshot, loadSnapshots, deleteSnapshot } = require('./services/storageService');
const sql = require('mssql');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Make io available globally for progress updates
global.io = io;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize storage on startup
initStorage().catch(console.error);

// Routes
app.get('/', async (req, res) => {
    try {
        const snapshots = await loadSnapshots();
        console.log('Loaded snapshots:', snapshots.length);
        res.render('index', { snapshots });
    } catch (error) {
        console.error('Error loading snapshots:', error);
        res.render('index', { snapshots: [] });
    }
});

app.get('/api/tables', async (req, res) => {
    try {
        const tables = await getTables();
        res.json({ success: true, tables });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/test-connection', async (req, res) => {
    try {
        await testConnection();
        res.json({ success: true, message: 'Database connection successful!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/snapshot', async (req, res) => {
    try {
        const selectedTables = req.body.tables || [];
        const snapshot = await takeSnapshot(selectedTables);
        await saveSnapshot(snapshot);
        res.json({ success: true, snapshot });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/compare', async (req, res) => {
    try {
        const { snapshot1, snapshot2 } = req.body;
        const differences = compareSnapshots(snapshot1, snapshot2);
        res.json({ success: true, differences });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/execute-query', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            throw new Error('Query is required');
        }
        
        // Prevent destructive queries
        const lowerQuery = query.toLowerCase().trim();
        if (lowerQuery.includes('drop') || 
            lowerQuery.includes('delete') || 
            lowerQuery.includes('truncate') || 
            lowerQuery.includes('update') || 
            lowerQuery.includes('insert') || 
            lowerQuery.includes('alter')) {
            throw new Error('Only SELECT queries are allowed');
        }

        if (!lowerQuery.startsWith('select')) {
            throw new Error('Only SELECT queries are allowed');
        }

        // Modify query to limit rows
        const ROW_LIMIT = 1001; // Get one extra row to check if there are more
        let limitedQuery = query;
        if (!lowerQuery.includes('top') && !lowerQuery.includes('offset')) {
            // Add TOP clause after SELECT
            limitedQuery = query.replace(/select\s+/i, `SELECT TOP ${ROW_LIMIT} `);
        }

        // Use the same config as dbSnapshot.js
        const config = {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            server: process.env.DB_SERVER,
            database: process.env.DB_NAME,
            options: {
                encrypt: true,
                trustServerCertificate: true
            }
        };

        const pool = await sql.connect(config);
        const result = await pool.request().query(limitedQuery);
        await sql.close();

        const recordset = result.recordset;
        const hasMore = recordset.length > 1000;
        const limitedRecordset = recordset.slice(0, 1000); // Only send first 1000 rows

        res.json({ 
            success: true, 
            result: limitedRecordset,
            hasMore: hasMore,
            totalRows: recordset.length
        });
    } catch (error) {
        console.error('Query execution error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/snapshots/:timestamp', async (req, res) => {
    try {
        await deleteSnapshot(req.params.timestamp);
        const snapshots = await loadSnapshots();
        res.json({ success: true, snapshots });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('disconnect', () => console.log('Client disconnected'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
