const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/chat', (req, res) =>
{
    res.render('chat');
});

let players = [];          
let currentWord = "кот";    
let usedWords = ["кот"];    
let currentPlayerIndex = 0; 
let gameActive = false;    

function checkWord(newWord, lastWord, used)
{
    newWord = newWord.toLowerCase().trim();
    lastWord = lastWord.toLowerCase();

    if (used.includes(newWord)) return false;
    if (newWord.length < 2) return false;

    let lastLetter = lastWord[lastWord.length - 1];
    if (newWord[0] !== lastLetter) return false;

    return true;
}

function startGame()
{
    if (players.length < 2) return;
    if (gameActive) return;

    gameActive = true;
    currentWord = "кот";
    usedWords = ["кот"];
    currentPlayerIndex = 0;

    io.emit('game_start', {
        currentWord: currentWord,
        currentPlayer: players[currentPlayerIndex].username
    });

    io.emit('system_msg', `Игра началась! Первое слово: "${currentWord}". Ходит ${players[currentPlayerIndex].username}`);
}

function nextTurn()
{
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    io.emit('turn_change',
        {
        currentPlayer: players[currentPlayerIndex].username,
        currentWord: currentWord
    });
    io.emit('system_msg', `Ходит ${players[currentPlayerIndex].username}. Текущее слово: "${currentWord}"`);
}

io.on('connection', (socket) =>
{
    console.log('Кто-то подключился');

    socket.on('set username', (username) =>
    {
        socket.username = username;
        players.push({ id: socket.id, username: username });

        io.emit('system_msg', `${username} присоединился! Игроков: ${players.length}`);

        if (players.length >= 2 && !gameActive) {
            startGame();
        }
    });

    socket.on('chat message', (msg) =>
    {
        if (!socket.username) return;

        if (!gameActive)
        {
            io.emit('chat_msg', { username: socket.username, text: msg });
            return;
        }

        let current = players[currentPlayerIndex];

        if (socket.username !== current.username)
        {
            socket.emit('system_msg', `Сейчас не твой ход! Ходит ${current.username}`);
            return;
        }

        if (!checkWord(msg, currentWord, usedWords))
        {
            let lastLetter = currentWord[currentWord.length - 1];
            socket.emit('system_msg', `Неверно! Слово должно начинаться на "${lastLetter}" и не повторяться`);
            return;
        }

        let newWord = msg.toLowerCase().trim();
        usedWords.push(newWord);
        currentWord = newWord;

        io.emit('chat_msg', { username: socket.username, text: `→ ${newWord} (всего слов: ${usedWords.length})` });

        if (usedWords.length >= 10)
        {
            io.emit('game_end', { winner: socket.username });
            io.emit('system_msg', `ПОБЕДА! Выиграл ${socket.username}! Сыграно слов: ${usedWords.length}`);
            gameActive = false;
            return;
        }

        nextTurn();
    });

    socket.on('disconnect', () =>
    {
        if (socket.username)
        {
            players = players.filter(p => p.id !== socket.id);
            io.emit('system_msg', `${socket.username} покинул игру. Игроков: ${players.length}`);

            if (gameActive && players.length < 2)
            {
                gameActive = false;
                io.emit('game_end', { reason: 'not_enough' });
                io.emit('system_msg', 'Игра остановлена: недостаточно игроков');
            }
        }
    });
});

server.listen(PORT, () =>
{
    console.log(`Сервер на http://localhost:${PORT}/chat`);
});
