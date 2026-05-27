const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const rest = require('./rest');
const store = require('./store');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    try {
        const recipes = store.getAll();
        res.render('index', { recipes: recipes });
    } catch (err) {
        res.status(500).send("Ошибка при загрузке данных: " + err.message);
    }
});

app.get('/chat', (req, res) => {
    res.render('chat');
});

app.get('/items', rest.getAllItems);
app.get('/items/:id', rest.getItemById);
app.post('/items', rest.createItem);
app.put('/items/:id', rest.updateItem);
app.delete('/items/:id', rest.deleteItem);

io.on('connection', (socket) => {
    console.log('Новое подключение');

    socket.on('set username', (username) => {
        socket.username = username;
        io.emit('chat message', {
            username: 'System',
            text: `${username} присоединился к чату`
        });
    });

    socket.on('chat message', (msg) => {
        io.emit('chat message', {
            username: socket.username || 'Аноним',
            text: msg
        });
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            io.emit('chat message', {
                username: 'System',
                text: `${socket.username} покинул чат`
            });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});