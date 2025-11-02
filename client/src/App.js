import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:4000");

// Example taboo words for each card
const TABOO_WORDS = {
  Apple: ["Fruit", "Red", "Tree", "Pie", "Juice"],
  Car: ["Drive", "Road", "Engine", "Wheel", "Vehicle"],
  Book: ["Read", "Pages", "Library", "Story", "Author"],
  Dog: ["Bark", "Pet", "Tail", "Puppy", "Animal"],
  // ... add for all words ...
};

function App() {
  // New state for clue and guess
  const [clue, setClue] = useState("");
  const [clueCount, setClueCount] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Helper to get team
  const getTeam = () => {
    if (!game) return null;
    if (game.redTeam?.includes(socket.id)) return "red";
    if (game.blueTeam?.includes(socket.id)) return "blue";
    return null;
  };

  // Helper to check if current user is clue giver
  const isClueGiver = () => {
    if (!game) return false;
    return game.clueGiver[game.turn] === socket.id;
  };

  // Helper to check if current user is clue master
  const isClueMaster = () => {
    if (!game) return false;
    return game.clueGiver[game.turn] === socket.id;
  };

  // Give clue
  const giveClue = () => {
    if (!clue.trim() || clueCount < 1) return;
    socket.emit("giveClue", { clue: clue.trim(), count: clueCount });
    setClue("");
    setClueCount(1);
  };

  // Guess word
  const guessWordCodenames = (index) => {
    socket.emit("guessWord", { index });
    setSelectedIndex(null);
  };
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [winner, setWinner] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [roundTime, setRoundTime] = useState(60); // default 60 seconds
  const [roundCount, setRoundCount] = useState(5); // default 5 rounds

  useEffect(() => {
    socket.on("roomData", (data) => {
      setRoom(data.room);
      setPlayers(data.players);
      setJoined(true);
    });

    socket.on("chatMessage", (msg) => {
      setChat((prev) => [...prev, msg]);
    });

    socket.on("gameState", (g) => {
      setGame(g);
    });

    socket.on("gameOver", (data) => {
      setWinner(data);
      setGame(null);
    });

    socket.on("errorMessage", (msg) => {
      alert(msg);
    });

    return () => {
      socket.off("roomData");
      socket.off("chatMessage");
      socket.off("gameState");
      socket.off("gameOver");
      socket.off("errorMessage");
    };
  }, []);

  const [error, setError] = useState("");

  const createRoom = () => {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!roundTime || isNaN(roundTime) || roundTime < 10) {
      setError("Please enter a valid round time (min 10 seconds).");
      return;
    }
    setError("");
    socket.auth = { name };
    socket.connect();
    socket.emit("createRoom", { roomName: name, roundTime: Number(roundTime), roundCount: Number(roundCount) });
    // setJoined will be set after receiving roomData
  };

  const joinByCode = () => {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setError("");
    socket.auth = { name };
    socket.connect();
    socket.emit("joinRoomByCode", { roomId: roomCode });
    setJoined(true);
  };

  const joinTeam = (team) => {
    socket.emit('joinTeam', { team });
  };

  const startGame = () => socket.emit("startGame");
  const sendChat = () => {
    socket.emit("chat", { text: input });
    setInput("");
  };
  const guessWord = () => {
    socket.emit("guess", { text: input });
    setInput("");
  };
  const passTurn = () => socket.emit("pass");
  const resetGame = () => {
    setWinner(null);
    setGame(null);
    setChat([]);
  };

  // Helper: get team members except describer
  function getGuessers(game) {
    const team = game.turn;
    const teamIds = team === 'red' ? game.redTeam : game.blueTeam;
    return teamIds.filter(id => id !== game.clueGiver[team]);
  }

  if (!joined) {
    return (
      <div className="center min-h-screen">
        <div className="container">
          <h1 className="text-4xl mb-6 font-bold center" style={{letterSpacing:2}}>
            <span style={{color:'#00c6ff'}}>scipher.gg</span> <span className="mobile-hide">|</span> Taboo Game
          </h1>
          <div className="card">
            {!joined && (
              <div className="card">
                <input
                  type="text"
                  className="p-2 text-black w-full mb-3"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  type="number"
                  className="p-2 text-black w-full mb-3"
                  placeholder="Round Time (seconds)"
                  min={10}
                  value={roundTime}
                  onChange={(e) => setRoundTime(e.target.value)}
                />
                <input
                  type="number"
                  className="p-2 text-black w-full mb-3"
                  placeholder="Number of Rounds"
                  min={1}
                  value={roundCount}
                  onChange={(e) => setRoundCount(e.target.value)}
                />
                {error && (
                  <div className="text-red-400 mb-2">{error}</div>
                )}
                <button
                  onClick={createRoom}
                  className="w-full mb-3"
                  disabled={!name.trim() || !roundTime || isNaN(roundTime) || roundTime < 10 || !roundCount || isNaN(roundCount) || roundCount < 1}
                >
                  ➕ Create Room
                </button>
                <div className="flex items-center mt-2">
                  <input
                    type="text"
                    className="p-2 text-black w-full"
                    placeholder="Enter Code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                  />
                  <button
                    onClick={joinByCode}
                    className="ml-2"
                    disabled={!name.trim()}
                  >
                    Join
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (joined && !game) {
    return (
      <div className="center min-h-screen">
        <div className="container">
          <div className="top-bar">
            <span className="game-title">Taboo Game</span>
            <span className="room-code">Room: {room?.id}</span>
            <button className="copy-btn" onClick={() => {navigator.clipboard.writeText(room?.id); alert('Room code copied!')}}>Copy</button>
          </div>
          <div className="card" style={{textAlign:'center'}}>
            <h3 className="text-lg mb-2 font-bold">👥 Players</h3>
            <div style={{marginBottom:'1em'}}>
              <button style={{background:'#ff4f4f',color:'#fff',marginRight:'1em',padding:'0.5em 1.2em',borderRadius:'8px',fontWeight:'bold',border:'none',cursor:'pointer'}} onClick={() => joinTeam('red')}>Join Red Team</button>
              <button style={{background:'#0072ff',color:'#fff',padding:'0.5em 1.2em',borderRadius:'8px',fontWeight:'bold',border:'none',cursor:'pointer'}} onClick={() => joinTeam('blue')}>Join Blue Team</button>
            </div>
            <div className="mb-2"><b>Red Team:</b></div>
            {room?.redTeam?.map((id) => {
              const p = players.find(pl => pl.id === id);
              return p ? (
                <div key={id} style={{color:'#ff4f4f'}}>{p.name}{room.clueGiver?.red === id ? ' (Describer)' : ''}</div>
              ) : null;
            })}
            <div className="mb-2 mt-2"><b>Blue Team:</b></div>
            {room?.blueTeam?.map((id) => {
              const p = players.find(pl => pl.id === id);
              return p ? (
                <div key={id} style={{color:'#0072ff'}}>{p.name}{room.clueGiver?.blue === id ? ' (Describer)' : ''}</div>
              ) : null;
            })}
          </div>
          <button onClick={startGame} style={{width:'100%',marginTop:'2em'}}>Start Game</button>
        </div>
      </div>
    );
  }

  // Describer interface (screenshot style)
  if (game && game.phase === 'play' && game.clueGiver[game.turn] === socket.id) {
    return (
      <div className="center min-h-screen" style={{background:'#181a20'}}>
        <div className="top-bar" style={{justifyContent:'center',marginBottom:'1em'}}>
          <span className="game-title" style={{color:'#b6ff00'}}>SCIPHER.GG</span>
          <span style={{margin:'0 2em',fontWeight:'bold',fontSize:'1.2em',color:'#fff'}}>TEAM {game.turn === 'red' ? '1' : '2'}'S TURN</span>
          <span style={{background:'#232526',borderRadius:'50%',padding:'0.7em 1.2em',color:'#ffd700',fontWeight:'bold',fontSize:'1.3em'}}>{game.timeLeft ?? game.timer}</span>
        </div>
        <div style={{textAlign:'center',marginBottom:'1em',fontSize:'1.2em',color:'#fff'}}>
          {players.find(p => p.id === game.clueGiver[game.turn])?.name}'s words are:
        </div>
        <div className="board" style={{gridTemplateColumns:'repeat(5,1fr)',gap:'1.2em',maxWidth:'900px',margin:'0 auto'}}>
          {game.board.map((card, idx) => (
            <div key={idx} className={`card-word${card.revealed ? ' revealed' : ''}`}
              style={{
                background: card.revealed ? (card.team ? (card.team === 'red' ? '#ff4f4f' : '#0072ff') : '#888') : '#232526',
                color: card.revealed ? '#fff' : '#ffd700',
                borderRadius:'14px',
                fontWeight:'bold',
                fontSize:'1.1em',
                boxShadow:'0 2px 8px rgba(0,0,0,0.10)',
                border:'2px solid #333',
                textAlign:'center',
                padding:'1.3em 0.5em',
                marginBottom:'0',
                position:'relative'
              }}>
              <div style={{fontSize:'1.1em'}}>{card.word}</div>
              <div style={{fontSize:'0.95em',color:'#bbb',marginTop:'0.5em'}}>{card.points ?? Math.floor(Math.random()*40+5)} points</div>
              {card.revealed && <div style={{marginTop:'0.5em',color:card.team === 'red' ? '#ff4f4f' : card.team === 'blue' ? '#0072ff' : '#fff',fontWeight:'bold'}}>Guessed!</div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:'2em',fontSize:'1.3em',color:'#fff',fontWeight:'bold'}}>
          <span style={{color:'#ff4f4f'}}>Team 1: {game.scores.red}</span> &nbsp;|&nbsp; <span style={{color:'#0072ff'}}>Team 2: {game.scores.blue}</span>
        </div>
      </div>
    );
  }

  // Guesser team interface
  if (game && game.phase === 'play' && getGuessers(game).includes(socket.id)) {
    return (
      <div className="center min-h-screen" style={{background:'#181a20'}}>
        <div className="top-bar" style={{justifyContent:'center',marginBottom:'1em'}}>
          <span className="game-title" style={{color:'#b6ff00'}}>SCIPHER.GG</span>
          <span style={{margin:'0 2em',fontWeight:'bold',fontSize:'1.2em',color:'#fff'}}>TEAM {game.turn === 'red' ? '1' : '2'}'S TURN</span>
          <span style={{background:'#232526',borderRadius:'50%',padding:'0.7em 1.2em',color:'#ffd700',fontWeight:'bold',fontSize:'1.3em'}}>{game.timeLeft ?? game.timer}</span>
        </div>
        <div style={{margin:'0 auto',maxWidth:'400px',textAlign:'center'}}>
          <input
            type="text"
            className="p-2 text-black w-full mb-3"
            placeholder="Type your guess"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { sendChat(); } }}
          />
          <button onClick={sendChat} className="w-full" style={{fontWeight:'bold',fontSize:'1.1em'}}>Send Guess</button>
        </div>
        <div style={{marginTop:'2em',fontSize:'1.3em',color:'#fff',fontWeight:'bold'}}>
          <span style={{color:'#ff4f4f'}}>Team 1: {game.scores.red}</span> &nbsp;|&nbsp; <span style={{color:'#0072ff'}}>Team 2: {game.scores.blue}</span>
        </div>
        <div className="chat-panel" style={{margin:'2em auto',maxWidth:'500px'}}>
          <h3 className="text-lg mb-2 font-bold">💬 Chat</h3>
          <div style={{height:'12em',overflowY:'auto',background:'#232526',borderRadius:'8px',padding:'0.5em',marginBottom:'1em'}}>
            {chat.map((msg, i) => (
              <div key={i} style={{marginBottom:'0.5em'}}>
                <b>{msg.name}:</b> <span style={{color: msg.color === 'red' ? '#ff4f4f' : msg.color === 'blue' ? '#0072ff' : msg.color === 'wrong' ? '#bbb' : '#fff',fontWeight:msg.color?'bold':'normal'}}>{msg.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Opponent team interface: show board and chat as read-only
  if (game && game.phase === 'play' && !getGuessers(game).includes(socket.id) && game.clueGiver[game.turn] !== socket.id) {
    return (
      <div className="center min-h-screen" style={{background:'#181a20'}}>
        <div className="top-bar" style={{justifyContent:'center',marginBottom:'1em'}}>
          <span className="game-title" style={{color:'#b6ff00'}}>SCIPHER.GG</span>
          <span style={{margin:'0 2em',fontWeight:'bold',fontSize:'1.2em',color:'#fff'}}>TEAM {game.turn === 'red' ? '1' : '2'}'S TURN</span>
          <span style={{background:'#232526',borderRadius:'50%',padding:'0.7em 1.2em',color:'#ffd700',fontWeight:'bold',fontSize:'1.3em'}}>{game.timeLeft ?? game.timer}</span>
        </div>
        <div style={{textAlign:'center',marginBottom:'1em',fontSize:'1.2em',color:'#fff'}}>
          {players.find(p => p.id === game.clueGiver[game.turn])?.name}'s words are:
        </div>
        <div className="board" style={{gridTemplateColumns:'repeat(5,1fr)',gap:'1.2em',maxWidth:'900px',margin:'0 auto'}}>
          {game.board.map((card, idx) => (
            <div key={idx} className={`card-word${card.revealed ? ' revealed' : ''}`}
              style={{
                background: card.revealed ? (card.team ? (card.team === 'red' ? '#ff4f4f' : '#0072ff') : '#888') : '#232526',
                color: card.revealed ? '#fff' : '#ffd700',
                borderRadius:'14px',
                fontWeight:'bold',
                fontSize:'1.1em',
                boxShadow:'0 2px 8px rgba(0,0,0,0.10)',
                border:'2px solid #333',
                textAlign:'center',
                padding:'1.3em 0.5em',
                marginBottom:'0',
                position:'relative'
              }}>
              <div style={{fontSize:'1.1em'}}>{card.word}</div>
              <div style={{fontSize:'0.95em',color:'#bbb',marginTop:'0.5em'}}>{card.points ?? Math.floor(Math.random()*40+5)} points</div>
              {card.revealed && <div style={{marginTop:'0.5em',color:card.team === 'red' ? '#ff4f4f' : card.team === 'blue' ? '#0072ff' : '#fff',fontWeight:'bold'}}>Guessed!</div>}
            </div>
          ))}
        </div>
        <div style={{marginTop:'2em',fontSize:'1.3em',color:'#fff',fontWeight:'bold'}}>
          <span style={{color:'#ff4f4f'}}>Team 1: {game.scores.red}</span> &nbsp;|&nbsp; <span style={{color:'#0072ff'}}>Team 2: {game.scores.blue}</span>
        </div>
        <div className="chat-panel" style={{margin:'2em auto',maxWidth:'500px'}}>
          <h3 className="text-lg mb-2 font-bold">💬 Chat (Guesses)</h3>
          <div style={{height:'12em',overflowY:'auto',background:'#232526',borderRadius:'8px',padding:'0.5em',marginBottom:'1em'}}>
            {chat.map((msg, i) => (
              <div key={i} style={{marginBottom:'0.5em'}}>
                <b>{msg.name}:</b> <span style={{color: msg.color === 'red' ? '#ff4f4f' : msg.color === 'blue' ? '#0072ff' : msg.color === 'wrong' ? '#bbb' : '#fff',fontWeight:msg.color?'bold':'normal'}}>{msg.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="center min-h-screen">
      <div className="container">
        <h2 className="text-3xl text-center mb-4 font-bold" style={{letterSpacing:2}}>
          <span style={{color:'#00c6ff'}}>scipher.gg</span> <span className="mobile-hide">|</span> Taboo Game
        </h2>
        {room && (
          <div className="text-center mb-3">
            <h4 style={{color:'#ffd700',fontFamily:'monospace',fontSize:'1.2em',display:'inline-block',marginRight:'1em'}}>
              Room Code: {room.id}
            </h4>
            <button
              style={{background:'#ffd700',color:'#232526',border:'none',borderRadius:'6px',padding:'0.3em 0.8em',fontWeight:'bold',cursor:'pointer'}}
              onClick={() => {
                navigator.clipboard.writeText(room.id);
                alert('Room code copied!');
              }}
            >Copy</button>
          </div>
        )}
        {game && (
          <div style={{textAlign:'center',marginBottom:'1em',fontSize:'1.2em'}}>
            ⏰ Time Left: <span style={{color:'#ffd700'}}>{game.timeLeft ?? game.timer}</span> sec
          </div>
        )}
        {game ? (
          <div className="flex">
            {/* LEFT SIDE - Chat */}
            <div className="card" style={{flex:1,minWidth:0}}>
              <h3 className="text-lg mb-2 font-bold">💬 Chat</h3>
              <div style={{height:'12em',overflowY:'auto',background:'#232526',borderRadius:'8px',padding:'0.5em',marginBottom:'1em'}}>
                {chat.map((msg, i) => (
                  <div key={i} style={{marginBottom:'0.5em'}}>
                    <b>{msg.name}:</b> <span style={{color: msg.color === 'red' ? '#ff4f4f' : msg.color === 'blue' ? '#0072ff' : msg.color === 'assassin' ? '#ffd700' : msg.color === 'wrong' ? '#bbb' : '#fff'}}>{msg.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex">
                <input
                  className="flex-1 text-black p-1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                />
                <button
                  onClick={sendChat}
                  className="ml-2"
                  style={{minWidth:'80px'}}
                >
                  Send
                </button>
              </div>
            </div>
            {/* MIDDLE - Game Board */}
            <div className="card center" style={{flex:2,minWidth:0}}>
              {/* Show winner if game over */}
              {game.phase === 'end' && (
                <div className="center" style={{width:'100%'}}>
                  <h2 className="text-3xl mb-4" style={{color:'#ffd700'}}>🏆 Winner: {game.winner?.toUpperCase()}</h2>
                  <button onClick={resetGame} style={{width:'100%'}}>Play Again</button>
                </div>
              )}
              {/* Clue phase */}
              {game.phase === 'clue' && (
                <div style={{width:'100%'}}>
                  <h3 className="text-xl font-bold mb-2" style={{color: game.turn === 'red' ? '#ff4f4f' : '#0072ff'}}>
                    {game.turn === 'red' ? 'Red' : 'Blue'} Team Clue Giver
                  </h3>
                  {game.clueGiver[game.turn] === socket.id ? (
                    <div className="flex center mb-2">
                      <input
                        type="text"
                        className="p-2 text-black"
                        placeholder="Enter clue"
                        value={clue}
                        onChange={(e) => setClue(e.target.value)}
                        style={{marginRight:'1em'}}
                      />
                      <input
                        type="number"
                        min={1}
                        className="p-2 text-black"
                        value={clueCount}
                        onChange={(e) => setClueCount(Number(e.target.value))}
                        style={{width:'60px'}}
                      />
                      <button onClick={giveClue} style={{marginLeft:'1em'}}>Give Clue</button>
                    </div>
                  ) : (
                    <div className="mb-2">Waiting for clue from your team's clue giver...</div>
                  )}
                  <div className="mb-2">Last clue: {game.clues.length > 0 ? `${game.clues[game.clues.length-1].clue} (${game.clues[game.clues.length-1].count})` : 'None'}</div>
                </div>
              )}
              {/* Guess phase */}
              {game.phase === 'guess' && (
                <div style={{width:'100%'}}>
                  <h3 className="text-xl font-bold mb-2" style={{color: game.turn === 'red' ? '#ff4f4f' : '#0072ff'}}>
                    {game.turn === 'red' ? 'Red' : 'Blue'} Team Guessing
                  </h3>
                  <div className="mb-2">Clue: {game.clues.length > 0 ? `${game.clues[game.clues.length-1].clue} (${game.clues[game.clues.length-1].count})` : 'None'}</div>
                  <div className="mb-2">Select a word from the board:</div>
                </div>
              )}
              {/* Board */}
              {game.board && isClueGiver() && (
                <div className="board">
                  {game.board.map((card, idx) => (
                    <button
                      key={idx}
                      disabled={card.revealed}
                      className={card.type}
                      style={{
                        background: card.revealed ? (card.type === 'red' ? '#ff4f4f' : card.type === 'blue' ? '#0072ff' : card.type === 'assassin' ? '#232526' : '#888') : '#232526',
                        color: card.revealed ? '#fff' : '#ffd700',
                        border: card.type === 'assassin' ? '2px solid #ff4f4f' : 'none',
                        fontWeight: card.revealed ? 'bold' : 'normal',
                        fontSize: '1em',
                        padding: '1em',
                        borderRadius: '8px',
                        cursor: card.revealed ? 'not-allowed' : 'pointer',
                      }}
                      onClick={() => game.phase === 'guess' && getTeam() === game.turn ? guessWordCodenames(idx) : null}
                    >
                      {card.word}
                    </button>
                  ))}
                </div>
              )}
              {game.board && !isClueGiver() && (
                <div className="board">
                  {game.board.map((card, idx) => (
                    <button
                      key={idx}
                      disabled
                      style={{
                        background: '#232526',
                        color: '#232526',
                        borderRadius: '12px',
                        fontSize: '1.2em',
                        fontWeight: '500',
                        padding: '1.2em',
                        border: '2px solid #333',
                        cursor: 'not-allowed',
                      }}
                    >
                      •••
                    </button>
                  ))}
                </div>
              )}
              {/* Scores */}
              <div className="flex center mt-4">
                <div style={{color:'#ff4f4f',fontWeight:'bold',marginRight:'2em'}}>Red: {game.scores.red}</div>
                <div style={{color:'#0072ff',fontWeight:'bold'}}>Blue: {game.scores.blue}</div>
              </div>
            </div>
            {/* RIGHT SIDE - Players & Team */}
            <div className="card" style={{flex:1,minWidth:0}}>
              <h3 className="text-lg mb-2 font-bold">👥 Players</h3>
              <div className="mb-2"><b>Red Team:</b></div>
              {game.redTeam?.map((id) => {
                const p = players.find(pl => pl.id === id);
                return p ? (
                  <div key={id} style={{color:'#ff4f4f'}}>{p.name}{game.clueGiver.red === id ? ' (Clue Giver)' : ''}</div>
                ) : null;
              })}
              <div className="mb-2 mt-2"><b>Blue Team:</b></div>
              {game.blueTeam?.map((id) => {
                const p = players.find(pl => pl.id === id);
                return p ? (
                  <div key={id} style={{color:'#0072ff'}}>{p.name}{game.clueGiver.blue === id ? ' (Clue Giver)' : ''}</div>
                ) : null;
              })}
            </div>
          </div>
        ) : (
          <div className="center" style={{width:'100%'}}>
            <button onClick={startGame} style={{width:'100%'}}>Start Game</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
