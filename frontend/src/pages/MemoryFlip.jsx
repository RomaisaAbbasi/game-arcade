import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { updateScore } from '../utils/api';

const EMOJIS = ['🍎', '🍌', '🐶', '🚗', '🌟', '🌙', '🌈', '🎈', '🐱', '🐼', '🦊', '🐨', '🍕', '🍦', '🎸', '🚀'];
const DIFFICULTIES = {
  easy: { pairs: 4, cols: 4, label: 'Easy', desc: '4 pairs – beginner' },
  medium: { pairs: 8, cols: 4, label: 'Medium', desc: '8 pairs – challenge' },
  hard: { pairs: 12, cols: 6, label: 'Hard', desc: '12 pairs – expert' }
};

const WIN_RATINGS = [
  { min: 90, label: 'PERFECT' },
  { min: 80, label: 'EXCELLENT' },
  { min: 70, label: 'GREAT' },
  { min: 60, label: 'GOOD' },
  { min: 0, label: 'KEEP PRACTICING' }
];

export default function MemoryFlip({ user }) {
  const [gameState, setGameState] = useState('idle'); // idle, playing, checking, paused, won
  const [difficulty, setDifficulty] = useState('easy');
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [victoryData, setVictoryData] = useState(null);
  const [confettiActive, setConfettiActive] = useState(false);

  const timerRef = useRef(null);
  const checkTimeout = useRef(null);
  const canvasRef = useRef(null);

  const totalPairs = DIFFICULTIES[difficulty].pairs;
  const bestScores = user?.scores?.memoryFlip || {};
  const [best, setBest] = useState({
    score: bestScores.bestScore || 0,
    time: bestScores.bestTime || 0,
    moves: bestScores.bestMoves || 0,
    accuracy: bestScores.bestAccuracy || 0,
    efficiency: bestScores.bestEfficiency || 0,
  });

  // ---- Shuffle ----
  const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ---- Generate Cards ----
  const generateCards = (pairs) => {
    const selected = shuffleArray([...EMOJIS]).slice(0, pairs);
    const doubled = [...selected, ...selected];
    const shuffled = shuffleArray(doubled);
    return shuffled.map((symbol, idx) => ({
      id: idx,
      symbol,
      isFlipped: false,
      isMatched: false,
    }));
  };

  // ---- Start Game ----
  const startGame = () => {
    const newCards = generateCards(totalPairs);
    setCards(newCards);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setMistakes(0);
    setCombo(0);
    setBestCombo(0);
    setScore(0);
    setStartTime(null);
    setElapsed(0);
    setIsPaused(false);
    setShowVictory(false);
    setVictoryData(null);
    setConfettiActive(false);
    setGameState('playing');
    if (timerRef.current) clearInterval(timerRef.current);
    if (checkTimeout.current) clearTimeout(checkTimeout.current);
  };

  // ---- Timer ----
  const startTimer = () => {
    if (!startTime) {
      const now = Date.now();
      setStartTime(now);
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - now) / 1000);
      }, 100);
    }
  };

  // ---- Handle Card Click ----
  const handleCardClick = (cardId) => {
    if (gameState === 'idle' || gameState === 'paused' || gameState === 'won') return;
    if (flipped.length === 2) return;
    if (matched.includes(cardId)) return;
    if (flipped.includes(cardId)) return;
    if (checkTimeout.current) return;

    // Start timer on first flip
    if (!startTime) startTimer();

    const newFlipped = [...flipped, cardId];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const id1 = newFlipped[0];
      const id2 = newFlipped[1];
      const card1 = cards.find(c => c.id === id1);
      const card2 = cards.find(c => c.id === id2);
      setMoves(prev => prev + 1);

      if (card1.symbol === card2.symbol) {
        // Match!
        setMatched(prev => [...prev, id1, id2]);
        const newCombo = combo + 1;
        setCombo(newCombo);
        if (newCombo > bestCombo) setBestCombo(newCombo);
        setScore(prev => prev + 100 * Math.min(newCombo, 5));
        setFlipped([]);

        // Check Win
        if (matched.length + 2 === totalPairs * 2) {
          handleWin();
        }
      } else {
        // Mismatch
        setMistakes(prev => prev + 1);
        setCombo(0);
        setGameState('checking');
        checkTimeout.current = setTimeout(() => {
          setFlipped([]);
          setGameState('playing');
          checkTimeout.current = null;
        }, 700);
      }
    }
  };

  // ---- Win Logic ----
  const handleWin = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('won');
    setConfettiActive(true);

    const acc = moves > 0 ? Math.round((totalPairs / moves) * 100) : 0;
    const eff = moves > 0 ? Math.round((totalPairs / moves) * 100) : 0;
    const perfScore = Math.round((acc + eff) / 2);
    const rating = WIN_RATINGS.find(r => perfScore >= r.min)?.label || 'KEEP PRACTICING';
    const finalScore = score + 1000 + (difficulty === 'hard' ? 500 : difficulty === 'medium' ? 200 : 0);

    const data = {
      score: finalScore,
      time: elapsed,
      moves,
      mistakes,
      accuracy: acc,
      efficiency: eff,
      rating,
      combo: bestCombo,
    };
    setVictoryData(data);
    setShowVictory(true);

    // Save to DB
    updateScore(user.name, 'memoryFlip', {
      bestScore: finalScore,
      bestTime: elapsed,
      bestMoves: moves,
      bestAccuracy: acc,
      bestEfficiency: eff,
    }).catch(console.error);

    // Update local best
    setBest({
      score: Math.max(best.score, finalScore),
      time: best.time === 0 ? elapsed : Math.min(best.time, elapsed),
      moves: best.moves === 0 ? moves : Math.min(best.moves, moves),
      accuracy: Math.max(best.accuracy, acc),
      efficiency: Math.max(best.efficiency, eff),
    });
  };

  // ---- Confetti Effect ----
  useEffect(() => {
    if (confettiActive && showVictory) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;

      const particles = [];
      const colors = ['#ff6b6b', '#ffd93d', '#6bcbff', '#a66cff', '#ff8a5c', '#4a7aff', '#ff8a9a'];
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h - h,
          w: 6 + Math.random() * 8,
          h: 4 + Math.random() * 6,
          vx: (Math.random() - 0.5) * 3,
          vy: 2 + Math.random() * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 6,
        });
      }

      let frame;
      const animate = () => {
        ctx.clearRect(0, 0, w, h);
        let alive = false;
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.rotSpeed;
          if (p.y < h + 20) alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot * Math.PI / 180);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
          ctx.restore();
        });
        if (alive) {
          frame = requestAnimationFrame(animate);
        } else {
          setConfettiActive(false);
        }
      };
      animate();
      return () => cancelAnimationFrame(frame);
    }
  }, [confettiActive, showVictory]);

  // ---- Pause / Resume ----
  const togglePause = () => {
    if (gameState !== 'playing' && gameState !== 'paused') return;
    if (isPaused) {
      setIsPaused(false);
      setGameState('playing');
      startTimer();
    } else {
      setIsPaused(true);
      setGameState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // ---- Restart ----
  const handleRestart = () => {
    if (window.confirm('Restart game? Your progress will be lost.')) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (checkTimeout.current) clearTimeout(checkTimeout.current);
      startGame();
    }
  };

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (checkTimeout.current) clearTimeout(checkTimeout.current);
    };
  }, []);

  // ---- Format Time ----
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // ---- Render Grid ----
  const renderGrid = () => {
    const cols = DIFFICULTIES[difficulty].cols;
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '10px',
        maxWidth: cols === 6 ? '550px' : '400px',
        margin: '0 auto',
        padding: '20px'
      }}>
        {cards.map(card => {
          const isFlipped = flipped.includes(card.id) || matched.includes(card.id);
          const isMatched = matched.includes(card.id);
          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className="memory-card"
              style={{
                aspectRatio: '1',
                perspective: '600px',
                cursor: isMatched || gameState === 'paused' ? 'default' : 'pointer',
                opacity: isMatched ? 0.5 : 1,
              }}
            >
              <div style={{
                width: '100%',
                height: '100%',
                transition: 'transform 0.3s ease',
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Front */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  background: '#2a1a4a',
                  borderRadius: '12px',
                  border: '2px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  🎴
                </div>
                {/* Back */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: '#1a1a3a',
                  borderRadius: '12px',
                  border: '2px solid rgba(255,215,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '36px',
                }}>
                  {card.symbol}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ---- Victory Modal ----
  const VictoryModal = () => {
    if (!victoryData) return null;
    const { score: finalScore, time, moves, mistakes, accuracy, efficiency, rating, combo } = victoryData;
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        backdropFilter: 'blur(8px)',
        padding: '20px',
      }}>
        <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 250 }} />
        <div style={{
          background: '#1a1a3a',
          padding: '30px 24px',
          borderRadius: '28px',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
          border: '1px solid rgba(255,215,0,0.1)',
          position: 'relative',
          zIndex: 300,
        }}>
          <div style={{ fontSize: '60px', marginBottom: '10px' }}>
            <span className="dancing-cartoon">🕺</span>
            <span className="dancing-cartoon" style={{ animationDelay: '0.2s' }}>💃</span>
          </div>
          <h2 style={{ color: '#ffd700', fontSize: '32px', marginBottom: '4px' }}>🎉 YOU DID IT!</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>All {totalPairs} pairs matched!</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Score</div>
              <div style={{ color: '#ffd700', fontSize: '20px', fontWeight: 'bold' }}>{finalScore}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Time</div>
              <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>{formatTime(time)}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Moves</div>
              <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>{moves}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Mistakes</div>
              <div style={{ color: '#ff6b6b', fontSize: '20px', fontWeight: 'bold' }}>{mistakes}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Accuracy</div>
              <div style={{ color: '#6bcbff', fontSize: '20px', fontWeight: 'bold' }}>{accuracy}%</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Efficiency</div>
              <div style={{ color: '#a66cff', fontSize: '20px', fontWeight: 'bold' }}>{efficiency}%</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px', gridColumn: 'span 2' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Rating</div>
              <div style={{ color: '#ffd93d', fontSize: '20px', fontWeight: 'bold' }}>{rating}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px' }}>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>Best Combo</div>
              <div style={{ color: '#ff8a5c', fontSize: '20px', fontWeight: 'bold' }}>{combo}x</div>
            </div>
          </div>

          {best.score > 0 && (
            <div style={{ marginBottom: '16px', color: '#ffd700', fontSize: '14px' }}>
              🏆 Best Score: {best.score} | Best Time: {formatTime(best.time)}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            <button onClick={startGame} style={btnStyle('#4a7aff')}>🔄 Play Again</button>
            <button onClick={() => { setShowVictory(false); setGameState('idle'); }} style={btnStyle('#666')}>⚙️ Change Difficulty</button>
            <Link to="/" style={{ ...btnStyle('#7a4aff'), textDecoration: 'none' }}>🏠 Home</Link>
          </div>
        </div>
      </div>
    );
  };

  const btnStyle = (bg) => ({
    padding: '10px 20px',
    borderRadius: '12px',
    border: 'none',
    background: bg,
    color: '#fff',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: '0.3s',
    display: 'inline-block',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
  });

  // ---- IDLE (Start Screen) ----
  if (gameState === 'idle') {
    return (
      <div style={{ padding: '30px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '44px', marginBottom: '8px' }}>🧠 Memory Flip</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px' }}>Match all pairs with the fewest moves!</p>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Choose Difficulty</h3>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {Object.keys(DIFFICULTIES).map(key => (
              <button key={key} onClick={() => setDifficulty(key)} style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: difficulty === key ? '2px solid #4a7aff' : '1px solid rgba(255,255,255,0.1)',
                background: difficulty === key ? 'rgba(74,122,255,0.2)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                cursor: 'pointer',
                transition: '0.3s',
              }}>
                <div style={{ fontWeight: 'bold' }}>{DIFFICULTIES[key].label}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{DIFFICULTIES[key].desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
          <div><span style={{ color: '#ffd700' }}>🏆 Best Score:</span> {best.score}</div>
          <div><span style={{ color: '#ffd700' }}>⏱️ Best Time:</span> {best.time ? formatTime(best.time) : '-'}</div>
          <div><span style={{ color: '#ffd700' }}>🎯 Best Moves:</span> {best.moves || '-'}</div>
        </div>
        <button onClick={startGame} style={{
          padding: '16px 48px',
          borderRadius: '16px',
          border: 'none',
          background: 'linear-gradient(135deg, #4a7aff, #7a4aff)',
          color: '#fff',
          fontSize: '22px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 8px 30px rgba(74,122,255,0.3)',
          transition: '0.3s'
        }} onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'} onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}>
          🚀 Start Game
        </button>
      </div>
    );
  }

  // ---- PLAYING / PAUSED / CHECKING ----
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* HUD */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '16px' }}>
        <div><span style={{ color: '#ffd700' }}>🏆</span> {score}</div>
        <div><span style={{ color: '#6bcbff' }}>🎯</span> {moves} moves</div>
        <div><span style={{ color: '#ff6b6b' }}>❌</span> {mistakes}</div>
        <div><span style={{ color: '#ffd93d' }}>🔥</span> {combo}x combo</div>
        <div><span style={{ color: '#fff' }}>⏱️</span> {formatTime(elapsed)}</div>
        <div><span style={{ color: '#aaa' }}>{DIFFICULTIES[difficulty].label}</span></div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={togglePause} style={btnStyle('#444')}>{isPaused ? '▶ Resume' : '⏸ Pause'}</button>
          <button onClick={handleRestart} style={btnStyle('#666')}>↻ Restart</button>
        </div>
      </div>

      {/* Cards Grid */}
      {renderGrid()}

      {/* Pause Overlay */}
      {isPaused && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ background: '#1a1a3a', padding: '40px', borderRadius: '24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '32px', marginBottom: '20px' }}>⏸ Game Paused</h2>
            <button onClick={togglePause} style={{ ...btnStyle('#4a7aff'), marginBottom: '12px', width: '100%' }}>▶ Resume</button>
            <button onClick={handleRestart} style={{ ...btnStyle('#ff6b6b'), marginBottom: '12px', width: '100%' }}>↻ Restart</button>
            <Link to="/" style={{ ...btnStyle('#666'), textDecoration: 'none', display: 'block' }}>🏠 Exit</Link>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {showVictory && <VictoryModal />}
    </div>
  );
}