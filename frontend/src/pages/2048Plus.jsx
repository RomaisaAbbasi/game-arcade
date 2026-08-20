import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { updateScore } from '../utils/api';

// ============ GAME CONFIG ============
const CONFIG = {
  gridSize: 4,
  startTiles: 2,
  spawnChance2: 0.9,
  maxUndoHistory: 5,
  milestoneMessages: {
    2048: { title: 'YOU MADE IT!', subtitle: '2048!', emoji: '🎉' },
    4096: { title: 'DOUBLE 2048!', subtitle: '4096!', emoji: '🔥' },
    8192: { title: 'UNSTOPPABLE!', subtitle: '8192!', emoji: '💪' },
    16384: { title: 'NUMBER MASTER!', subtitle: '16384!', emoji: '👑' },
    32768: { title: 'ABSOLUTE LEGEND!', subtitle: '32768!', emoji: '🏆' }
  }
};

const TILE_COLORS = {
  2: { bg: '#eee4da', text: '#776e65' },
  4: { bg: '#ede0c8', text: '#776e65' },
  8: { bg: '#f2b179', text: '#f9f6f2' },
  16: { bg: '#f59563', text: '#f9f6f2' },
  32: { bg: '#f67c5f', text: '#f9f6f2' },
  64: { bg: '#f65e3b', text: '#f9f6f2' },
  128: { bg: '#edcf72', text: '#f9f6f2' },
  256: { bg: '#edcc61', text: '#f9f6f2' },
  512: { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
  4096: { bg: '#60d992', text: '#f9f6f2' },
  8192: { bg: '#3c9a6e', text: '#f9f6f2' },
  16384: { bg: '#2c7a5a', text: '#f9f6f2' },
  32768: { bg: '#1c5a4a', text: '#f9f6f2' },
  65536: { bg: '#0c3a3a', text: '#f9f6f2' }
};

const getTileColor = (value) => {
  if (value > 65536) return { bg: '#0a2a2a', text: '#f9f6f2' };
  return TILE_COLORS[value] || { bg: '#cdc1b4', text: '#776e65' };
};

const getTileFontSize = (value) => {
  if (value < 100) return 32;
  if (value < 1000) return 28;
  if (value < 10000) return 24;
  if (value < 100000) return 20;
  return 16;
};

// ============ GAME LOGIC (Pure Functions) ============
const createEmptyBoard = (size) => Array.from({ length: size }, () => Array(size).fill(0));

const getEmptyCells = (board) => {
  const cells = [];
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] === 0) cells.push({ row: r, col: c });
    }
  }
  return cells;
};

const spawnRandomTile = (board, chance2 = 0.9) => {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return board;
  const { row, col } = empty[Math.floor(Math.random() * empty.length)];
  const value = Math.random() < chance2 ? 2 : 4;
  const newBoard = board.map(row => [...row]);
  newBoard[row][col] = value;
  return newBoard;
};

const processLine = (line) => {
  // Remove zeros, then merge
  let filtered = line.filter(v => v !== 0);
  let merged = [];
  let score = 0;
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i++; // skip the next one
    } else {
      merged.push(filtered[i]);
    }
  }
  while (merged.length < line.length) {
    merged.push(0);
  }
  return { line: merged, score };
};

const moveLeft = (board) => {
  let newBoard = [];
  let totalScore = 0;
  for (let row of board) {
    const result = processLine(row);
    newBoard.push(result.line);
    totalScore += result.score;
  }
  return { board: newBoard, score: totalScore };
};

const moveRight = (board) => {
  const reversed = board.map(row => [...row].reverse());
  const result = moveLeft(reversed);
  return { board: result.board.map(row => row.reverse()), score: result.score };
};

const moveUp = (board) => {
  const transposed = board[0].map((_, col) => board.map(row => row[col]));
  const result = moveLeft(transposed);
  return { board: result.board[0].map((_, col) => result.board.map(row => row[col])), score: result.score };
};

const moveDown = (board) => {
  const transposed = board[0].map((_, col) => board.map(row => row[col]));
  const result = moveRight(transposed);
  return { board: result.board[0].map((_, col) => result.board.map(row => row[col])), score: result.score };
};

const canMove = (board) => {
  // Check empty cells
  if (getEmptyCells(board).length > 0) return true;
  // Check horizontal
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length - 1; c++) {
      if (board[r][c] === board[r][c + 1]) return true;
    }
  }
  // Check vertical
  for (let c = 0; c < board[0].length; c++) {
    for (let r = 0; r < board.length - 1; r++) {
      if (board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
};

const getHighestTile = (board) => {
  let max = 0;
  for (let row of board) {
    for (let v of row) {
      if (v > max) max = v;
    }
  }
  return max;
};

const boardToString = (board) => board.map(row => row.join(',')).join(';');

// ============ MAIN COMPONENT ============
export default function TwentyFortyEight({ user }) {
  // --- State ---
  const [board, setBoard] = useState(() => {
    // Load saved game from localStorage
    const saved = localStorage.getItem('2048plus_game');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.board && data.board.length === 4) return data.board;
      } catch (e) {}
    }
    return createEmptyBoard(4);
  });
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => {
    const saved = localStorage.getItem('2048plus_best');
    return saved ? parseInt(saved) : 0;
  });
  const [moves, setMoves] = useState(0);
  const [highestTile, setHighestTile] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [milestone, setMilestone] = useState(null); // { value, title, subtitle }
  const [undoStack, setUndoStack] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showAchievement, setShowAchievement] = useState(null);
  const [achievements, setAchievements] = useState(() => {
    const saved = localStorage.getItem('2048plus_achievements');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Best from backend ---
  const backendBest = user?.scores?.twothousandFortyEight?.bestScore || 0;
  useEffect(() => {
    if (backendBest > bestScore) {
      setBestScore(backendBest);
      localStorage.setItem('2048plus_best', String(backendBest));
    }
  }, [backendBest]);

  // --- Save game on changes ---
  useEffect(() => {
    if (!gameOver) {
      localStorage.setItem('2048plus_game', JSON.stringify({ board, score, moves, highestTile }));
    }
    localStorage.setItem('2048plus_best', String(bestScore));
  }, [board, score, moves, highestTile, gameOver, bestScore]);

  // --- Update highest tile ---
  useEffect(() => {
    const current = getHighestTile(board);
    if (current > highestTile) {
      setHighestTile(current);
      // Check milestones
      for (const [key, msg] of Object.entries(CONFIG.milestoneMessages)) {
        const val = parseInt(key);
        if (current >= val && !achievements.includes(key)) {
          setMilestone({ value: val, ...msg });
          // Achievement unlock
          setAchievements(prev => [...prev, key]);
          localStorage.setItem('2048plus_achievements', JSON.stringify([...achievements, key]));
          // Show popup after a delay
          setTimeout(() => {
            setShowAchievement({ id: key, title: msg.title, subtitle: msg.subtitle, emoji: msg.emoji });
          }, 500);
        }
      }
    }
  }, [board, highestTile, achievements]);

  // --- Game over detection ---
  useEffect(() => {
    if (board && board.length) {
      if (!canMove(board) && getEmptyCells(board).length === 0) {
        setGameOver(true);
        // Save final stats to backend
        if (user) {
          const data = {
            bestScore: Math.max(backendBest, score),
            highestTile: Math.max(user.scores?.twothousandFortyEight?.highestTile || 0, highestTile),
            gamesPlayed: (user.scores?.twothousandFortyEight?.gamesPlayed || 0) + 1,
            gamesWon: user.scores?.twothousandFortyEight?.gamesWon || 0,
            bestMovesTo2048: 0 // not tracking yet
          };
          updateScore(user.name, 'twothousandFortyEight', data).catch(console.error);
        }
      }
    }
  }, [board]);

  // --- Perform move ---
  const performMove = (moveFn) => {
    if (gameOver || isAnimating) return;
    const result = moveFn(board);
    // Check if board changed
    const newBoard = result.board;
    if (boardToString(newBoard) === boardToString(board)) return; // invalid move

    // Push state to undo stack
    setUndoStack(prev => {
      const newStack = [...prev, { board, score, moves, highestTile }];
      if (newStack.length > CONFIG.maxUndoHistory) newStack.shift();
      return newStack;
    });

    const newScore = score + result.score;
    setBoard(newBoard);
    setScore(newScore);
    setMoves(prev => prev + 1);
    if (newScore > bestScore) {
      setBestScore(newScore);
      localStorage.setItem('2048plus_best', String(newScore));
    }
    // Spawn new tile
    const withSpawn = spawnRandomTile(newBoard, CONFIG.spawnChance2);
    setBoard(withSpawn);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 100);
  };

  // --- Undo ---
  const undo = () => {
    if (undoStack.length === 0 || gameOver) return;
    const last = undoStack.pop();
    setBoard(last.board);
    setScore(last.score);
    setMoves(last.moves);
    setHighestTile(last.highestTile);
    setUndoStack([...undoStack]);
  };

  // --- New game ---
  const startNewGame = () => {
    let newBoard = createEmptyBoard(4);
    for (let i = 0; i < CONFIG.startTiles; i++) {
      newBoard = spawnRandomTile(newBoard, CONFIG.spawnChance2);
    }
    setBoard(newBoard);
    setScore(0);
    setMoves(0);
    setHighestTile(0);
    setGameOver(false);
    setUndoStack([]);
    setMilestone(null);
    setShowAchievement(null);
    localStorage.removeItem('2048plus_game');
    setShowNewGameConfirm(false);
  };

  // --- Continue saved game ---
  const continueGame = () => {
    const saved = localStorage.getItem('2048plus_game');
    if (saved) {
      const data = JSON.parse(saved);
      setBoard(data.board);
      setScore(data.score);
      setMoves(data.moves);
      setHighestTile(data.highestTile);
      setGameOver(false);
    }
  };

  // --- Keyboard controls ---
  const handleKeyDown = useCallback((e) => {
    const key = e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      e.preventDefault();
    }
    if (key === 'ArrowLeft') performMove(moveLeft);
    if (key === 'ArrowRight') performMove(moveRight);
    if (key === 'ArrowUp') performMove(moveUp);
    if (key === 'ArrowDown') performMove(moveDown);
    if (key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  }, [board, gameOver, isAnimating, undoStack]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // --- Swipe support ---
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === 0 && touchStartY.current === 0) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return; // too small
    if (absDx > absDy) {
      if (dx > 0) performMove(moveRight);
      else performMove(moveLeft);
    } else {
      if (dy > 0) performMove(moveDown);
      else performMove(moveUp);
    }
    touchStartX.current = 0;
    touchStartY.current = 0;
  };

  // --- Render tile ---
  const renderTile = (value, row, col) => {
    if (value === 0) return <div key={`${row}-${col}`} className="tile-empty" />;
    const color = getTileColor(value);
    const fontSize = getTileFontSize(value);
    return (
      <div
        key={`${row}-${col}`}
        className="tile"
        style={{
          backgroundColor: color.bg,
          color: color.text,
          fontSize: `${fontSize}px`,
          transform: 'scale(1)',
          transition: 'transform 0.08s'
        }}
      >
        {value}
      </div>
    );
  };

  // --- Achievement popup ---
  const AchievementPopup = () => {
    if (!showAchievement) return null;
    return (
      <div className="achievement-popup">
        <div className="achievement-content">
          <span style={{ fontSize: '40px' }}>🏆</span>
          <h3>{showAchievement.title}</h3>
          <p>{showAchievement.subtitle}</p>
        </div>
        <button onClick={() => setShowAchievement(null)} style={{ marginTop: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '4px 12px', borderRadius: '12px' }}>×</button>
      </div>
    );
  };

  // --- Milestone celebration modal ---
  const MilestoneModal = () => {
    if (!milestone) return null;
    return (
      <div className="milestone-overlay">
        <div className="milestone-modal">
          <div style={{ fontSize: '60px' }}>{milestone.emoji}</div>
          <h2>{milestone.title}</h2>
          <p>{milestone.subtitle}</p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button onClick={() => setMilestone(null)} className="btn-primary">Keep Playing</button>
            <button onClick={() => { setMilestone(null); startNewGame(); }} className="btn-secondary">New Game</button>
          </div>
        </div>
      </div>
    );
  };

  // --- Game Over Modal ---
  const GameOverModal = () => {
    if (!gameOver) return null;
    const messages = [
      highestTile >= 4096 ? 'Your numbers were unstoppable.' :
      highestTile >= 2048 ? '2048 conquered. Can you go even further?' :
      highestTile >= 512 ? 'You\'re getting seriously good at this.' :
      'One more game. Your next run could be huge.'
    ];
    return (
      <div className="gameover-overlay">
        <div className="gameover-modal">
          <div style={{ fontSize: '48px' }}>💥</div>
          <h2>GAME OVER</h2>
          <div className="stats-grid">
            <div><span>Score</span><strong>{score}</strong></div>
            <div><span>Highest Tile</span><strong>{highestTile}</strong></div>
            <div><span>Moves</span><strong>{moves}</strong></div>
            <div><span>Best Score</span><strong>{bestScore}</strong></div>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>{messages[0]}</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '16px' }}>
            <button onClick={startNewGame} className="btn-primary">Try Again</button>
            <button onClick={undo} disabled={undoStack.length === 0} className="btn-secondary" style={{ opacity: undoStack.length === 0 ? 0.5 : 1 }}>↩ Undo</button>
            <Link to="/" className="btn-secondary">🏠 Home</Link>
          </div>
        </div>
      </div>
    );
  };

  // --- Render board ---
  const renderBoard = () => {
    return (
      <div className="board" style={{ display: 'grid', gridTemplateColumns: `repeat(4, 1fr)`, gap: '8px', maxWidth: '500px', margin: '0 auto' }}>
        {board.map((row, r) =>
          row.map((val, c) => renderTile(val, r, c))
        )}
      </div>
    );
  };

  // --- HUD ---
  const HUD = () => (
    <div className="hud">
      <div className="hud-item"><span>Score</span><strong>{score}</strong></div>
      <div className="hud-item"><span>Best</span><strong>{bestScore}</strong></div>
      <div className="hud-item"><span>Moves</span><strong>{moves}</strong></div>
      <div className="hud-item"><span>Highest</span><strong>{highestTile}</strong></div>
    </div>
  );

  // --- Controls ---
  const Controls = () => (
    <div className="controls" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
      <button onClick={undo} disabled={undoStack.length === 0} className="btn-secondary" style={{ opacity: undoStack.length === 0 ? 0.5 : 1 }}>↩ Undo</button>
      <button onClick={() => setShowNewGameConfirm(true)} className="btn-secondary">🔄 New Game</button>
      <button onClick={() => {}} className="btn-secondary">🔊 Sound</button>
    </div>
  );

  // --- Start screen (idle) ---
  const [showStartScreen, setShowStartScreen] = useState(true);
  const hasSavedGame = localStorage.getItem('2048plus_game') !== null;

  if (showStartScreen) {
    return (
      <>
        <Helmet>
          <title>2048 Plus – Play Free Online Number Puzzle Game</title>
          <meta name="description" content="Play 2048 Plus online for free. Merge matching number tiles, reach 2048 and challenge yourself to reach 4096, 8192 and beyond." />
        </Helmet>
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
          <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>2048 Plus</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>Merge numbers. Build your strategy. Reach 2048 and go beyond.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px' }}>
            <button onClick={() => { setShowStartScreen(false); startNewGame(); }} className="btn-primary" style={{ padding: '16px', fontSize: '20px' }}>🚀 Start Game</button>
            {hasSavedGame && (
              <button onClick={() => { setShowStartScreen(false); continueGame(); }} className="btn-secondary" style={{ padding: '14px' }}>↩ Continue Game</button>
            )}
            <button onClick={() => {}} className="btn-secondary" style={{ padding: '12px', fontSize: '14px' }}>📖 How to Play</button>
          </div>
        </div>
      </>
    );
  }

  // --- Main game render ---
  return (
    <>
      <Helmet>
        <title>2048 Plus – Free Online Number Puzzle</title>
        <meta name="description" content="Play 2048 Plus online for free. Merge matching number tiles, reach 2048 and challenge yourself to reach 4096, 8192 and beyond." />
      </Helmet>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '32px', display: 'inline-block', background: 'linear-gradient(135deg, #8ab4ff, #ff8a9a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>2048 Plus</h1>
        </div>
        <HUD />
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {renderBoard()}
        </div>
        <Controls />
        <MilestoneModal />
        <GameOverModal />
        <AchievementPopup />
        {showNewGameConfirm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Start a New Game?</h3>
              <p>Your current progress will be lost.</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button onClick={() => { setShowNewGameConfirm(false); startNewGame(); }} className="btn-primary">Yes, New Game</button>
                <button onClick={() => setShowNewGameConfirm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}