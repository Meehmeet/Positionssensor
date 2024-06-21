const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const https = require('https');
const WebSocket = require('ws');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

const options = {
    key: fs.readFileSync('./cerificates/server.key'),
    cert: fs.readFileSync('./cerificates/server.crt')
};

const server = https.createServer(options, app);
const wss = new WebSocket.Server({ server });

let db; // MongoDB client instance

// MongoDB connection URI with username and password
const mongoURI = "mongodb://mongoadmin:mysecret@10.115.2.18:8017/";

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db('position'); // Use or create 'position' database

        // WebSocket server setup
        wss.on('connection', function connection(ws) {
            console.log('A new client connected');

            ws.on('message', async function incoming(message) {
                console.log('Received from client:', message);

                try {
                    // Convert Buffer to UTF-8 string
                    const messageString = message.toString('utf8');
                    console.log('Received message as string:', messageString);

                    // Parse the string as JSON
                    const data = JSON.parse(messageString);

                    // Replace the existing document or insert a new one
                    const collection = db.collection('sensor_data');
                    await collection.updateOne({}, { $set: data }, { upsert: true });
                    console.log('Sensor data saved to MongoDB');
                } catch (err) {
                    console.error('Error parsing or saving sensor data:', err);
                }

                // Broadcast message to all clients
                wss.clients.forEach(function each(client) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(messageString); // Send the original message back as JSON string
                    }
                });
            });

            ws.on('close', function () {
                console.log('Client disconnected');
            });
        });

        server.listen(3001, () => {
            console.log('WebSocket server listening on port 3001');
        });

    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1); // Exit the process on connection error
    }
}

// Initialize MongoDB connection
connectToMongoDB().catch(err => {
    console.error('MongoDB connection initialization error:', err);
    process.exit(1); // Exit the process on connection error
});

app.use(function (req, res, next) {
    next(createError(404));
});

app.use(function (err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
