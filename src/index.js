require('dotenv').config();
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { compareSnapshots } = require('./services/dbCompare');
const { takeSnapshot, testConnection, getTables } = require('./services/dbSnapshot');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Make io available globally for progress updates
global.io = io;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

// API endpoints
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
        const snapshot = await takeSnapshot();
        res.json({ success: true, snapshot });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/compare', async (req, res) => {
    try {
        const { snapshot1, snapshot2 } = req.body;
        const differences = await compareSnapshots(snapshot1, snapshot2);
        res.json({ success: true, differences });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
