import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { updateScore } from '../utils/api';
import './WordHunt.css';

// ============================================================
// WORD DATABASE
// ============================================================
const WORDS = {
  easy: [
    'CAT', 'DOG', 'SUN', 'TREE', 'BALL', 'BOOK', 'FISH', 'BIRD',
    'APPLE', 'MOON', 'STAR', 'HOME', 'BLUE', 'GREEN', 'RAIN', 'CAKE',
    'MILK', 'CAR', 'FROG', 'SHIP', 'BED', 'HAT', 'CUP', 'PEN',
    'BAG', 'MAP', 'ANT', 'FOX', 'OWL', 'PIG'
  ],
  medium: [
    'GARDEN', 'WINDOW', 'MUSIC', 'RIVER', 'CLOUD', 'TIGER', 'ORANGE',
    'SCHOOL', 'PLANET', 'FLOWER', 'SUMMER', 'FRIEND', 'BRIDGE', 'FOREST',
    'BASKET', 'CANDLE', 'DREAM', 'EAGLE', 'FALCON', 'GINGER', 'HAPPY',
    'JUNGLE', 'KITCHEN', 'LIGHTHOUSE', 'MIRROR', 'NIGHT', 'OCEAN'
  ],
  hard: [
    'ADVENTURE', 'BUTTERFLY', 'CHOCOLATE', 'MOUNTAIN', 'TREASURE',
    'ELEPHANT', 'SUNSHINE', 'RAINBOW', 'JOURNEY', 'DISCOVERY',
    'FRIENDSHIP', 'NOTEBOOK', 'PINEAPPLE', 'QUARTER', 'SILVER',
    'TURTLE', 'UNIVERSE', 'VIOLET', 'WHISPER', 'XENON',
    'YELLOW', 'ZEBRA', 'BALLOON', 'CIRCUS', 'DINOSAUR',
    'ENJOY', 'FAMILY', 'GALAXY', 'HORIZON', 'ICEBOX'
  ]
};

// ============================================================
// DIFFICULTY CONFIG
// ============================================================
const DIFFICULTY = {
  easy: { wordCount: 6, timeLimit: 180, label: 'Easy', icon: '🌱', color: '#27D7C4' },
  medium: { wordCount: 8, timeLimit: 120, label: 'Medium', icon: '⭐', color: '#7C5CFF' },
  hard: { wordCount: 12, timeLimit: 90, label: 'Hard', icon: '🔥', color: '#FF5C7A' }
};

// ============================================================
// PUZZLE GENERATOR
// ============================================================
const generatePuzzle = (difficulty) => {
  const config = DIFFICULTY[difficulty];
  const wordPool = WORDS[difficulty];
  const selected = [];
  const poolCopy = [...wordPool];
  for (let i = 0; i < config.wordCount; i++) {
    const idx = Math.floor(Math.random() * poolCopy.length);
    selected.push(poolCopy.splice(idx, 1)[0]);
  }
  const gridSize = 8;
  const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));
  const placedWords = [];
  const directions = [
    { dr: 0, dc: 1 }, { dr: 0, dc: -1 }, { dr: 1, dc: 0 }, { dr: -1, dc: 0 },
    { dr: 1, dc: 1 }, { dr: -1, dc: -1 }, { dr: 1, dc: -1 }, { dr: -1, dc: 1 }
  ];
  for (const word of selected) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 100) {
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);
      const dir = directions[Math.floor(Math.random() * directions.length)];
      let canPlace = true;
      for (let i = 0; i < word.length; i++) {
        const r = row + i * dir.dr;
        const c = col + i * dir.dc;
        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) { canPlace = false; break; }
        if (grid[r][c] !== '' && grid[r][c] !== word[i]) { canPlace = false; break; }
      }
      if (canPlace) {
        const positions = [];
        for (let i = 0; i < word.length; i++) {
          const r = row + i * dir.dr;
          const c = col + i * dir.dc;
          grid[r][c] = word[i];
          positions.push({ row: r, col: c });
        }
        placedWords.push({ word, positions, direction: dir });
        placed = true;
      }
      attempts++;
    }
    if (!placed) {
      for (let i = 0; i < gridSize; i++) {
        let canPlace = true;
        for (let j = 0; j < word.length; j++) {
          if (grid[i][j] !== '' && grid[i][j] !== word[j]) { canPlace = false; break; }
        }
        if (canPlace) {
          const positions = [];
          for (let j = 0; j < word.length; j++) {
            grid[i][j] = word[j];
            positions.push({ row: i, col: j });
          }
          placedWords.push({ word, positions, direction: { dr: 0, dc: 1 } });
          placed = true;
          break;
        }
      }
    }
  }
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
      }
    }
  }
  return { grid, placedWords };
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function WordHunt({ user }) {
  // --- State ---
  const [screen, setScreen] = useState('start');
  const [difficulty, setDifficulty] = useState('easy');
  const [grid, setGrid] = useState([]);
  const [targetWords, setTargetWords] = useState([]);
  const [foundWords, setFoundWords] = useState([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timer, setTimer] = useState(180);
  const [timerActive, setTimerActive] = useState(false);
  const [selectedCells, setSelectedCells] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [startCell, setStartCell] = useState(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [correctAttempts, setCorrectAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [resultData, setResultData] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [bestScores, setBestScores] = useState({
    easy: { score: 0, stars: 0 },
    medium: { score: 0, stars: 0 },
    hard: { score: 0, stars: 0 }
  });

  // --- Refs ---
  const gridRef = useRef(null);
  const timerInterval = useRef(null);
  const startTimeRef = useRef(null);

  // --- Load best scores from user ---
  useEffect(() => {
    if (user?.scores?.wordHunt) {
      const wh = user.scores.wordHunt;
      setBestScores({
        easy: { score: wh.easyScore || 0, stars: wh.easyStars || 0 },
        medium: { score: wh.mediumScore || 0, stars: wh.mediumStars || 0 },
        hard: { score: wh.hardScore || 0, stars: wh.hardStars || 0 }
      });
    } else {
      const stored = JSON.parse(localStorage.getItem('wordHuntBest') || '{}');
      setBestScores(prev => ({
        easy: { score: stored.easy?.score || 0, stars: stored.easy?.stars || 0 },
        medium: { score: stored.medium?.score || 0, stars: stored.medium?.stars || 0 },
        hard: { score: stored.hard?.score || 0, stars: stored.hard?.stars || 0 }
      }));
    }
  }, [user]);

  // --- Star rating ---
  const getStars = (diff, found, acc, timeLeft) => {
    const total = DIFFICULTY[diff].wordCount;
    if (found === total && acc >= 90 && timeLeft > 10) return 3;
    if (found >= total * 0.8 && acc >= 70) return 2;
    return 1;
  };

  // --- Game over handler ---
  const handleGameOver = () => {
    setTimerActive(false);
    if (timerInterval.current) clearInterval(timerInterval.current);
    const acc = correctAttempts + wrongAttempts > 0
      ? Math.round((correctAttempts / (correctAttempts + wrongAttempts)) * 100)
      : 0;
    setAccuracy(acc);
    const finalScore = score;
    const stars = getStars(difficulty, foundWords.length, acc, timer);
    const data = {
      score: finalScore,
      wordsFound: foundWords.length,
      totalWords: targetWords.length,
      accuracy: acc,
      combo: bestCombo,
      stars,
      hintsUsed
    };
    setResultData(data);
    setScreen('gameover');

    if (user) {
      const diff = difficulty;
      const scoreKey = diff + 'Score';
      const starsKey = diff + 'Stars';
      const payload = {
        [scoreKey]: Math.max(bestScores[diff]?.score || 0, finalScore),
        [starsKey]: Math.max(bestScores[diff]?.stars || 0, stars),
        bestAccuracy: Math.max(user.scores?.wordHunt?.bestAccuracy || 0, acc),
        bestCombo: Math.max(user.scores?.wordHunt?.bestCombo || 0, bestCombo),
        gamesPlayed: (user.scores?.wordHunt?.gamesPlayed || 0) + 1
      };
      updateScore(user.name, 'wordHunt', payload).catch(console.error);
    }
    const stored = JSON.parse(localStorage.getItem('wordHuntBest') || '{}');
    if (!stored[difficulty] || stored[difficulty].score < finalScore) {
      stored[difficulty] = { score: finalScore, stars };
      localStorage.setItem('wordHuntBest', JSON.stringify(stored));
    }
  };

  // --- Start game ---
  const startGame = (diff) => {
    setDifficulty(diff);
    const config = DIFFICULTY[diff];
    const { grid, placedWords } = generatePuzzle(diff);
    setGrid(grid);
    setTargetWords(placedWords.map(w => w.word));
    setFoundWords([]);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimer(config.timeLimit);
    setTimerActive(true);
    setSelectedCells([]);
    setIsDragging(false);
    setStartCell(null);
    setWrongAttempts(0);
    setCorrectAttempts(0);
    setHintsUsed(0);
    setAccuracy(0);
    setResultData(null);
    setShowConfetti(false);
    setScreen('playing');
    if (timerInterval.current) clearInterval(timerInterval.current);
    startTimeRef.current = Date.now();
    timerInterval.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval.current);
          setTimerActive(false);
          handleGameOver();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // --- Selection handlers ---
  const handlePointerDown = (row, col) => {
    if (screen !== 'playing' || !timerActive) return;
    setIsDragging(true);
    setStartCell({ row, col });
    setSelectedCells([{ row, col }]);
  };

  const handlePointerMove = (row, col) => {
    if (!isDragging || !startCell) return;
    const dr = row - startCell.row;
    const dc = col - startCell.col;
    if (dr === 0 && dc === 0) return;
    const maxDiff = Math.max(Math.abs(dr), Math.abs(dc));
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return;
    const stepR = dr === 0 ? 0 : dr / maxDiff;
    const stepC = dc === 0 ? 0 : dc / maxDiff;
    const cells = [];
    for (let i = 0; i <= maxDiff; i++) {
      const r = startCell.row + i * stepR;
      const c = startCell.col + i * stepC;
      if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
      cells.push({ row: r, col: c });
    }
    setSelectedCells(cells);
  };

  const handlePointerUp = () => {
    if (!isDragging || selectedCells.length < 3) {
      setIsDragging(false);
      setSelectedCells([]);
      setStartCell(null);
      return;
    }
    const word = selectedCells.map(({ row, col }) => grid[row][col]).join('');
    if (targetWords.includes(word) && !foundWords.includes(word)) {
      setFoundWords(prev => [...prev, word]);
      setCorrectAttempts(prev => prev + 1);
      const baseScore = word.length * 10 + 20;
      const comboBonus = combo * 5;
      const addScore = baseScore + comboBonus;
      setScore(prev => prev + addScore);
      setCombo(prev => prev + 1);
      if (combo + 1 > bestCombo) setBestCombo(combo + 1);
      showFloatingText('+' + addScore, '#45E6A8');
      if (foundWords.length + 1 === targetWords.length) {
        setTimeout(() => {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
          handleGameOver();
        }, 500);
      }
    } else {
      setWrongAttempts(prev => prev + 1);
      setCombo(0);
      shakeCells(selectedCells);
    }
    setIsDragging(false);
    setSelectedCells([]);
    setStartCell(null);
  };

  // --- Visual helpers ---
  const shakeCells = (cells) => {
    const tiles = document.querySelectorAll('.letter-tile');
    cells.forEach(({ row, col }) => {
      const idx = row * 8 + col;
      if (tiles[idx]) {
        tiles[idx].classList.add('shake');
        setTimeout(() => tiles[idx].classList.remove('shake'), 500);
      }
    });
  };

  const showFloatingText = (text, color) => {
    const el = document.createElement('div');
    el.className = 'floating-score';
    el.textContent = text;
    el.style.color = color;
    el.style.position = 'fixed';
    el.style.top = '50%';
    el.style.left = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.fontSize = '48px';
    el.style.fontWeight = 'bold';
    el.style.zIndex = '100';
    el.style.animation = 'floatUp 1s ease-out forwards';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  };

  // --- Hint ---
  const useHint = () => {
    if (hintsUsed >= 3 || screen !== 'playing') return;
    const unfound = targetWords.filter(w => !foundWords.includes(w));
    if (unfound.length === 0) return;
    const word = unfound[Math.floor(Math.random() * unfound.length)];
    let pos = null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (grid[r][c] === word[0]) {
          pos = { row: r, col: c };
          break;
        }
      }
      if (pos) break;
    }
    if (pos) {
      const idx = pos.row * 8 + pos.col;
      const tile = document.querySelectorAll('.letter-tile')[idx];
      if (tile) {
        tile.classList.add('hint-glow');
        setTimeout(() => tile.classList.remove('hint-glow'), 1500);
      }
      setHintsUsed(prev => prev + 1);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (screen === 'start') {
    return (
      <>
        <Helmet>
          <title>Word Hunt – Free Online Word Search Game</title>
          <meta name="description" content="Find hidden words in an addictive 8×8 word search puzzle. Play Easy, Medium and Hard levels and challenge your best score." />
        </Helmet>
        <div className="wordhunt-start">
          <div className="wh-start-content">
            <div className="wh-logo">🔍 WORD HUNT</div>
            <p className="wh-tagline">Find hidden words. Beat your best score.</p>
            <div className="wh-difficulty-cards">
              {Object.keys(DIFFICULTY).map(key => {
                const cfg = DIFFICULTY[key];
                const best = bestScores[key]?.score || 0;
                return (
                  <div key={key} className="wh-card" style={{ borderColor: cfg.color }}>
                    <div className="wh-card-icon">{cfg.icon}</div>
                    <h3>{cfg.label}</h3>
                    <p>{cfg.wordCount} words</p>
                    <p className="wh-card-time">{cfg.timeLimit}s</p>
                    {best > 0 && <div className="wh-card-best">🏆 {best}</div>}
                    <button className="wh-play-btn" onClick={() => startGame(key)}>PLAY</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'playing') {
    return (
      <>
        <Helmet><title>Word Hunt – Playing</title></Helmet>
        <div className="wordhunt-game">
          <div className="wh-header">
            <div className="wh-header-left">
              <Link to="/games" className="wh-back">← Back</Link>
              <span className="wh-level">{DIFFICULTY[difficulty].label}</span>
            </div>
            <div className="wh-header-center">🔍 WORD HUNT</div>
            <div className="wh-header-right">
              <span className="wh-score">⭐ {score}</span>
              <span className="wh-timer">⏱️ {Math.floor(timer/60)}:{(timer%60).toString().padStart(2,'0')}</span>
            </div>
          </div>
          <div className="wh-main">
            <div className="wh-left">
              <div className="wh-progress">
                <span>{foundWords.length} / {targetWords.length} words found</span>
                <div className="wh-progress-bar" style={{ width: `${(foundWords.length/targetWords.length)*100}%` }} />
              </div>
              <div className="wh-word-list">
                {targetWords.map((word, idx) => (
                  <div key={idx} className={`wh-word-item ${foundWords.includes(word) ? 'found' : ''}`}>
                    {foundWords.includes(word) ? '✓' : '○'} {word}
                  </div>
                ))}
              </div>
              {combo > 1 && <div className="wh-combo">🔥 COMBO ×{combo}</div>}
            </div>
            <div className="wh-center">
              <div className="wh-grid" ref={gridRef}>
                {grid.map((row, r) => (
                  row.map((letter, c) => {
                    const isSelected = selectedCells.some(cell => cell.row === r && cell.col === c);
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`letter-tile ${isSelected ? 'selected' : ''}`}
                        onPointerDown={() => handlePointerDown(r, c)}
                        onPointerMove={() => handlePointerMove(r, c)}
                        onPointerUp={handlePointerUp}
                        style={{ touchAction: 'none' }}
                      >
                        {letter}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>
            <div className="wh-right">
              <button className="wh-hint-btn" onClick={useHint} disabled={hintsUsed >= 3}>💡 Hint ({3-hintsUsed})</button>
              <button className="wh-shuffle-btn" onClick={() => { /* shuffle not implemented */ }}>🔀 Shuffle</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (screen === 'gameover' && resultData) {
    const { score: finalScore, wordsFound, totalWords, accuracy, combo, stars, hintsUsed } = resultData;
    return (
      <>
        <Helmet><title>Word Hunt – Game Over</title></Helmet>
        <div className="wh-modal-overlay">
          <div className="wh-modal">
            <h2>{wordsFound === totalWords ? '🎉 LEVEL COMPLETE!' : '⏰ TIME\'S UP!'}</h2>
            <p>{wordsFound === totalWords ? 'All words found!' : `You found ${wordsFound} / ${totalWords} words`}</p>
            <div className="wh-stats">
              <div><span>Score</span><strong>{finalScore}</strong></div>
              <div><span>Accuracy</span><strong>{accuracy}%</strong></div>
              <div><span>Best Combo</span><strong>{combo}x</strong></div>
              <div><span>Hints Used</span><strong>{hintsUsed}</strong></div>
            </div>
            <div className="wh-stars">{'⭐'.repeat(stars)}{'☆'.repeat(3-stars)}</div>
            <div className="wh-modal-buttons">
              <button onClick={() => startGame(difficulty)} className="wh-btn-primary">🔄 Play Again</button>
              <button onClick={() => setScreen('start')} className="wh-btn-secondary">🏠 Menu</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}