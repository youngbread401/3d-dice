const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(__dirname));

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        try {
            // Immediately broadcast the message to ALL clients
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocketServer.OPEN) {
                    client.send(message.toString());
                }
            });
        } catch (error) {
            console.error('Error broadcasting message:', error);
        }
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});