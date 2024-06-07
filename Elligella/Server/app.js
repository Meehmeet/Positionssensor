const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const https = require('https');
const WebSocket = require('ws');
const fs = require('fs');

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
    key: fs.readFileSync('.\\cerificates\\server.key'),
    cert: fs.readFileSync('.\\cerificates\\server.crt')
};

var storedMessage = '{"type":"Buffer","data":[123,34,97,108,112,104,97,34,58,49,46,51,125]}';
 
const server = https.createServer(options, app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
    console.log('A new client connected');

    ws.on('message', function incoming(message) {
        console.log('Received from first client: %s', message);
        
        storedMessage = message; // Update storedMessage here
        wss.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', function () {
        console.log('Client disconnected');
    });
});

server.listen(3001, () => {
    console.log('WebSocket server listening on port 3001');
    // Call sendStoragedMessage every 1 second
    setInterval(sendStoragedMessage, 1);
});

const wss2 = new WebSocket.Server({ port: 8080 });

wss2.on('connection', function connection(ws) {
    console.log('New client connected to second WebSocket');




    ws.on('message', function incoming(message) {
        console.log('Received from second client: %s', message);
        // Broadcast the received message to all clients connected to wss2
        wss2.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', function close() {
        console.log('Connection closed for second client');
    });
});

function sendStoragedMessage() {
    const messageString = JSON.stringify(storedMessage); // Convert storedMessage to a string
    wss2.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString); // Send the stringified message
        }
    });
}

app.use(function(req, res, next) {
    next(createError(404));
});

app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
