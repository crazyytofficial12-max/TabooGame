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

// 🔧 Render এর জন্য PORT ঠিক করা হলো
const PORT = process.env.PORT || 4000;

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

function generateTabooBoard() {
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

// 🔧 generateBoard ফাংশন ফিক্স করা হলো
const generateBoard = () => {
  const allWords = [...WORDS.easy, ...WORDS.medium, ...WORDS.hard, ...WORDS.insane];
  const shuffled = allWords.sort(() => Math.random() - 0.5).slice(0, 25);

  const types = Array(9).fill('red')
    .concat(Array(8).fill('blue'))
    .concat(Array(7).fill('neutral'))
    .concat(['assassin']);

  const shuffledTypes = types.sort(() => Math.random() - 0.5);

  return shuffled.map((word, i) => ({
    word,
    type: shuffledTypes[i],
    revealed: false
  }));
};

// ... আপনার বাকি socket.io কোড একই থাকবে ...

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
