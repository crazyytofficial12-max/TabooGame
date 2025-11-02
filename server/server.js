const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = 4000;

let lobbyRooms = [];
let rooms = {};

const WORDS = {
  easy: [
    "Apple", "Car", "Book", "Dog", "Phone", "Chair", "Table", "Sun", "Moon", "Star", "Tree", "House", "Road", "Water", "Cat", "Mouse"
  ],
  medium: [
    "River", "Cloud", "Bird", "Fish", "Flower", "Grass", "Window", "Door", "Light", "Shadow", "Ring", "King", "Queen"
  ],
  hard: [
    "Fire", "Mountain", "Galaxy", "Engine", "Library", "Author", "Puppy", "Vehicle", "Story", "Tail"
  ],
  insane: [
    "Quantum", "Algorithm", "Paradox", "Nebula", "Symbiosis", "Eclipse", "Entropy", "Singularity"
  ]
};

const TABOO_WORDS = {
  Apple: ["Fruit", "Red", "Tree", "Pie", "Juice"],
  Car: ["Drive", "Road", "Engine", "Wheel", "Vehicle"],
  Book: ["Read", "Pages", "Library", "Story", "Author"],
  Dog: ["Bark", "Pet", "Tail", "Puppy", "Animal"],
  // ... add for all words ...
};
function getRandomWord() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  return { word, taboo: TABOO_WORDS[word] || [] };
}

function generateTabooBoard() {
  // 2 easy, 2 medium, 2 hard, 2 insane per round
  const easyWords = [...WORDS.easy].sort(() => Math.random() - 0.5).slice(0, 2);
  const mediumWords = [...WORDS.medium].sort(() => Math.random() - 0.5).slice(0, 2);
  const hardWords = [...WORDS.hard].sort(() => Math.random() - 0.5).slice(0, 2);
  const insaneWords = [...WORDS.insane].sort(() => Math.random() - 0.5).slice(0, 2);
  const allWords = [...easyWords, ...mediumWords, ...hardWords, ...insaneWords].sort(() => Math.random() - 0.5);
  return allWords.map(word => {
    let difficulty, points;
    if (WORDS.easy.includes(word)) {
      difficulty = 'easy';
      points = Math.floor(Math.random() * 3) + 6; // 6-8
    } else if (WORDS.medium.includes(word)) {
      difficulty = 'medium';
      points = Math.floor(Math.random() * 5) + 10; // 10-14
    } else if (WORDS.hard.includes(word)) {
      difficulty = 'hard';
      points = Math.floor(Math.random() * 11) + 20; // 20-30
    } else {
      difficulty = 'insane';
      points = Math.floor(Math.random() * 25) + 40; // 40-64
    }
    return {
      word,
      taboo: TABOO_WORDS[word] || [],
      revealed: false,
      points,
      difficulty,
      team: null
    };
  });
}

const generateBoard = () => {
  // 5x5 grid, 25 words
  const shuffled = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 25);
  // Assign teams: 9 red, 8 blue, 7 neutral, 1 assassin
  const types = Array(9).fill('red').concat(Array(8).fill('blue')).concat(Array(7).fill('neutral')).concat(['assassin']);
  const shuffledTypes = types.sort(() => Math.random() - 0.5);
  return shuffled.map((word, i) => ({ word, type: shuffledTypes[i], revealed: false }));
};

io.on("connection", (socket) => {
  console.log("connected:", socket.id);
  const name = socket.handshake.auth?.name || "Guest";

  socket.on("joinLobby", () => {
    socket.emit("lobbyRooms", lobbyRooms);
  });

  socket.on("createRoom", ({ roomName, roundTime, roundCount }) => {
    const roomId = "room-" + Math.random().toString(36).slice(2, 8);
    const room = {
      id: roomId,
      name: roomName,
      hostId: socket.id,
      players: {},
      game: null,
      roundTime: roundTime || 60,
      roundCount: roundCount || 5
    };
    rooms[roomId] = room;
    lobbyRooms.push({ id: roomId, name: roomName, count: 1 });
    room.players[socket.id] = { id: socket.id, name };
    socket.join(roomId);
    io.to(socket.id).emit("roomData", {
      room,
      players: Object.values(room.players),
      hostId: room.hostId,
    });
    io.emit(
      "lobbyRooms",
      lobbyRooms.map((r) => ({
        id: r.id,
        name: r.name,
        count: Object.keys(r.players || {}).length,
      }))
    );
  });

  // ✅ Step 9A: join by room code
  socket.on("joinRoomByCode", ({ roomId }) => {
  const code = (roomId || "").trim().toLowerCase();
  const room = Object.values(rooms).find((r) => r.id.toLowerCase() === code);
  if (!room) {
    socket.emit("errorMessage", "Invalid room code!");
    return;
  }
  const name = socket.handshake.auth?.name || "Guest";
  room.players[socket.id] = { id: socket.id, name };
  socket.join(roomId);
  io.to(roomId).emit("roomData", {
    room,
    players: Object.values(room.players),
    hostId: room.hostId,
  });
});

  socket.on("chat", ({ text }) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith("room-"));
    if (!roomId) return;
    const room = rooms[roomId];
    const game = room.game;
    if (!game || game.phase !== 'play') {
      io.to(roomId).emit("chatMessage", { name, text });
      return;
    }
    // Only guessers can guess
    const team = game.turn;
    if (game.clueGiver[team] === socket.id) {
      io.to(roomId).emit("chatMessage", { name, text });
      return;
    }
    // Check if guessed word matches any unrevealed word
    const guessIdx = game.board.findIndex(card => card.word.toLowerCase() === text.trim().toLowerCase() && !card.revealed);
    if (guessIdx !== -1) {
      game.board[guessIdx].revealed = true;
      game.board[guessIdx].team = team;
      game.scores[team] += game.board[guessIdx].points;
      io.to(roomId).emit("chatMessage", { name, text, color: team });
      io.to(roomId).emit("gameState", game);
      // If 7 or more words revealed, add new words
      const revealedCount = game.board.filter(card => card.revealed).length;
      if (revealedCount >= 7) {
        const unrevealed = game.board.filter(card => !card.revealed);
        const newWords = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 3).map(word => ({
          word,
          taboo: TABOO_WORDS[word] || [],
          revealed: false,
          points: Math.floor(Math.random()*40+5),
          team: null
        }));
        game.board = [...game.board, ...newWords];
        io.to(roomId).emit("gameState", game);
      }
      return;
    }
    // Wrong guess
    io.to(roomId).emit("chatMessage", { name, text, color: 'wrong' });
  });

  socket.on("startGame", () => {
    const roomId = [...socket.rooms].find((r) => r.startsWith("room-"));
    if (!roomId) return;
    const room = rooms[roomId];
    if (socket.id !== room.hostId) return;

    // Assign teams
    const playerIds = Object.keys(room.players);
    const shuffled = playerIds.sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    const redTeam = shuffled.slice(0, mid);
    const blueTeam = shuffled.slice(mid);

    // Assign clue givers (first in each team)
    room.game = {
      phase: "play",
      redTeam,
      blueTeam,
      clueGiver: { red: redTeam[0], blue: blueTeam[0] },
      turn: 'red',
      scores: { red: 0, blue: 0 },
      winner: null,
      timer: room.roundTime || 60,
      timeLeft: room.roundTime || 60,
      board: generateTabooBoard(),
      chat: [],
    };
    io.to(roomId).emit("gameState", room.game);
    startRoundTimer(room);
  });

  socket.on("giveClue", ({ clue }) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith("room-"));
    if (!roomId) return;
    const room = rooms[roomId];
    const game = room.game;
    if (!game || game.phase !== 'clue') return;
    // Only clue giver can give clue
    if (socket.id !== game.clueGiver[game.turn]) return;
    game.clues.push({ team: game.turn, clue });
    game.phase = 'guess';
    game.timeLeft = game.timer;
    io.to(roomId).emit("gameState", game);
  });

  socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
  });

  socket.on("joinTeam", ({ team }) => {
    const roomId = [...socket.rooms].find((r) => r.startsWith("room-"));
    if (!roomId) return;
    const room = rooms[roomId];
    if (!room) return;
    // Remove from both teams first
    room.redTeam = (room.redTeam || []).filter(id => id !== socket.id);
    room.blueTeam = (room.blueTeam || []).filter(id => id !== socket.id);
    // Add to selected team
    if (team === 'red') {
      room.redTeam = room.redTeam || [];
      room.redTeam.push(socket.id);
    } else if (team === 'blue') {
      room.blueTeam = room.blueTeam || [];
      room.blueTeam.push(socket.id);
    }
    // Ensure player name is set from handshake
    const name = socket.handshake.auth?.name || "Guest";
    room.players[socket.id] = { id: socket.id, name };
    io.to(roomId).emit("roomData", {
      room,
      players: Object.values(room.players),
      hostId: room.hostId,
    });
  });
});

let timerInterval = null;
function startRoundTimer(room) {
  clearInterval(timerInterval);
  if (!room.game || !room.game.timer) return;
  room.game.timeLeft = room.game.timer;
  timerInterval = setInterval(() => {
    if (!room.game || room.game.phase === 'end') {
      clearInterval(timerInterval);
      return;
    }
    room.game.timeLeft--;
    io.to(room.id).emit("gameState", room.game);
    if (room.game.timeLeft <= 0) {
      clearInterval(timerInterval);
      // End round, switch turn, new board
      room.game.phase = 'play';
      room.game.turn = room.game.turn === 'red' ? 'blue' : 'red';
      room.game.board = generateTabooBoard();
      room.game.timeLeft = room.game.timer;
      io.to(room.id).emit("gameState", room.game);
      startRoundTimer(room);
    }
  }, 1000);
}

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
