import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { updateScore } from '../utils/api';

// ============================================================
// CONFIGURATION
// ============================================================
const LEVELS = [
  { 
    id: 1, 
    label: 'Level 1', 
    description: 'Easy · 1 minute', 
    timeLimit: 60, 
    baseSpeed: 4, 
    spawnIntervalBase: 120, 
    spawnIntervalMin: 50,
    color: '#4a7aff'
  },
  { 
    id: 2, 
    label: 'Level 2', 
    description: 'Hard · 1 minute', 
    timeLimit: 60, 
    baseSpeed: 5.5, 
    spawnIntervalBase: 100, 
    spawnIntervalMin: 40,
    color: '#ff6b6b'
  }
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function SpaceJump({ user }) {
  // --- State ---
  const [screen, setScreen] = useState('start'); // start | playing | gameover | levelcomplete | allcomplete
  const [currentLevel, setCurrentLevel] = useState(0); // 0-based index
  const [highScore, setHighScore] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [levelHighScore, setLevelHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);

  // --- Refs for game loop ---
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const isSpaceHeldRef = useRef(false);
  const gameStateRef = useRef({
    player: { x: 80, y: 0, vy: 0, width: 32, height: 40 },
    groundY: 0,
    obstacles: [],
    score: 0,
    isOver: false,
    spawnTimer: 0,
    speed: 4,
    levelComplete: false,
  });

  // --- Get difficulty from level index ---
  const getLevelConfig = (idx) => {
    const lvl = LEVELS[idx];
    return {
      baseSpeed: lvl.baseSpeed,
      spawnIntervalBase: lvl.spawnIntervalBase,
      spawnIntervalMin: lvl.spawnIntervalMin,
      timeLimit: lvl.timeLimit,
    };
  };

  // --- Load best scores from user ---
  useEffect(() => {
    const spaceScores = user?.scores?.spaceJump || {};
    setHighScore(spaceScores.highScore || 0);
    // For simplicity, we store only one high score, but we can show per level if needed
  }, [user]);

  // --- Save score ---
  const saveHighScore = async (score) => {
    try {
      await updateScore(user.name, 'spaceJump', { highScore: score, level: currentLevel + 1 });
      setHighScore(score);
    } catch (err) {
      console.error('Failed to save high score:', err);
    }
  };

  // --- Start level ---
  const startLevel = (idx) => {
    setCurrentLevel(idx);
    setScreen('playing');
    setLevelHighScore(0);
    initGame(highScore, idx);
  };

  // --- Initialize game ---
  const initGame = (savedHighScore = 0, idx = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    const groundY = canvas.height - 80;
    const state = gameStateRef.current;
    const config = getLevelConfig(idx);

    state.player.x = 80;
    state.player.y = groundY - state.player.height;
    state.player.vy = 0;
    state.player.width = 32;
    state.player.height = 40;
    state.groundY = groundY;
    state.obstacles = [];
    state.score = 0;
    state.isOver = false;
    state.levelComplete = false;
    state.spawnTimer = 0;
    state.speed = config.baseSpeed;
    state.highScore = savedHighScore;

    setCurrentScore(0);
    setLevelHighScore(savedHighScore);
    setTimeLeft(config.timeLimit);

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    startTimeRef.current = Date.now();
    gameLoop(idx);
  };

  // --- Game loop ---
  const gameLoop = (idx) => {
    const state = gameStateRef.current;
    if (state.isOver || state.levelComplete) return;

    const config = getLevelConfig(idx);
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const remaining = Math.max(0, config.timeLimit - elapsed);
    setTimeLeft(Math.ceil(remaining));

    if (remaining <= 0) {
      state.levelComplete = true;
      setScreen('levelcomplete');
      saveHighScore(state.score);
      return;
    }

    update(idx);
    render();
    animFrameRef.current = requestAnimationFrame(() => gameLoop(idx));
  };

  // --- Update physics ---
  const update = (idx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = gameStateRef.current;
    const { player, groundY, obstacles } = state;
    const GRAVITY = 0.6;
    const config = getLevelConfig(idx);

    // Jump / fall
    if (isSpaceHeldRef.current) {
      player.vy = -4;
    } else {
      player.vy += GRAVITY;
    }
    player.y += player.vy;

    // Ground collision
    const floorY = groundY - player.height;
    if (player.y > floorY) {
      player.y = floorY;
      player.vy = 0;
    }
    if (player.y < 0) {
      player.y = 0;
      player.vy = 0;
    }

    // Spawn obstacles
    state.spawnTimer += 1;
    const spawnInterval = Math.max(config.spawnIntervalMin, config.spawnIntervalBase - state.score / 5);
    if (state.spawnTimer > spawnInterval) {
      state.spawnTimer = 0;
      const size = 20 + Math.random() * 20;
      obstacles.push({
        x: canvas.width + 20,
        y: groundY - size,
        width: size,
        height: size,
        type: Math.floor(Math.random() * 3),
      });
    }

    // Move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= state.speed;
      if (obs.x + obs.width < -20) {
        obstacles.splice(i, 1);
        state.score += 5;
        setCurrentScore(state.score);
        state.speed = Math.min(12, config.baseSpeed + Math.floor(state.score / 200));
      }
    }

    // Collision
    const p = player;
    for (const obs of obstacles) {
      if (
        p.x < obs.x + obs.width &&
        p.x + p.width > obs.x &&
        p.y < obs.y + obs.height &&
        p.y + p.height > obs.y
      ) {
        state.isOver = true;
        setScreen('gameover');
        saveHighScore(state.score);
        return;
      }
    }
  };

  // --- Render (Canvas) ---
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = gameStateRef.current;
    const { player, groundY, obstacles, score } = state;
    const w = canvas.width;
    const h = canvas.height;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#050a1a');
    grad.addColorStop(0.5, '#0d1b3e');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (let i = 0; i < 120; i++) {
      const sx = ((i * 137 + 33) % w);
      const sy = ((i * 271 + 97) % h);
      const size = ((i * 7) % 3) + 1;
      const brightness = 0.5 + 0.5 * Math.sin(Date.now() / 1000 + i);
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * brightness})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground
    ctx.shadowColor = '#4a7aff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#2a1a4a';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.shadowBlur = 0;
    ctx.shadowColor = '#7aafff';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#6a8aff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Obstacles
    const colors = ['#ff6b6b', '#ffd93d', '#6bcbff', '#a66cff', '#ff8a5c'];
    for (const obs of obstacles) {
      const color = colors[obs.type % colors.length];
      ctx.shadowColor = color;
      ctx.shadowBlur = 25;
      ctx.fillStyle = color;
      const cx = obs.x + obs.width / 2;
      const cy = obs.y + obs.height / 2;
      const r = obs.width / 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Date.now() / 3000;
        const rad = r * (0.7 + 0.3 * Math.sin(i * 3 + Date.now() / 2000));
        const px = cx + Math.cos(angle) * rad;
        const py = cy + Math.sin(angle) * rad;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 5;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Player (Astronaut)
    const px = player.x;
    const py = player.y;
    ctx.shadowColor = '#4af';
    ctx.shadowBlur = 30;
    const bodyGrad = ctx.createLinearGradient(px, py, px + player.width, py + player.height);
    bodyGrad.addColorStop(0, '#e8f0ff');
    bodyGrad.addColorStop(0.5, '#b0c8ff');
    bodyGrad.addColorStop(1, '#7a9fff');
    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 25;
    const bw = player.width;
    const bh = player.height;
    const br = 8;
    ctx.beginPath();
    ctx.moveTo(px + br, py);
    ctx.lineTo(px + bw - br, py);
    ctx.quadraticCurveTo(px + bw, py, px + bw, py + br);
    ctx.lineTo(px + bw, py + bh - br);
    ctx.quadraticCurveTo(px + bw, py + bh, px + bw - br, py + bh);
    ctx.lineTo(px + br, py + bh);
    ctx.quadraticCurveTo(px, py + bh, px, py + bh - br);
    ctx.lineTo(px, py + br);
    ctx.quadraticCurveTo(px, py, px + br, py);
    ctx.closePath();
    ctx.fill();

    // Helmet
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#1a2a5a';
    ctx.beginPath();
    ctx.arc(px + bw / 2, py + 12, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a8aff';
    ctx.beginPath();
    ctx.arc(px + bw / 2 - 2, py + 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(px + bw / 2 - 5, py + 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 5;
    ctx.strokeStyle = '#c0d0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + bw / 2, py + 12, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(px + bw / 2 - 5, py + 10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + bw / 2 + 5, py + 10, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Flame
    if (isSpaceHeldRef.current) {
      ctx.shadowColor = '#ff6a00';
      ctx.shadowBlur = 40;
      const flameH = 8 + Math.random() * 8;
      const gradFlame = ctx.createLinearGradient(px + bw / 2, py + bh, px + bw / 2, py + bh + flameH);
      gradFlame.addColorStop(0, '#ff8a00');
      gradFlame.addColorStop(0.5, '#ff4400');
      gradFlame.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = gradFlame;
      ctx.beginPath();
      ctx.moveTo(px + bw / 2 - 6, py + bh);
      ctx.lineTo(px + bw / 2, py + bh + flameH);
      ctx.lineTo(px + bw / 2 + 6, py + bh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ---- UI Text (on canvas) ----
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillText(`⭐ ${Math.floor(score)}`, 20, 20);

    // High score
    ctx.fillStyle = '#ffd700';
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.fillText(`🏆 ${state.highScore || 0}`, 20, 52);

    // Player name
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText(`👨‍🚀 ${user.name}`, 20, 78);

    // Level display
    const lvl = LEVELS[currentLevel];
    ctx.fillStyle = lvl.color;
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillText(`🎯 ${lvl.label}`, 20, 105);

    // Timer
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    ctx.fillText(`⏱️ ${mins}:${secs.toString().padStart(2, '0')}`, w - 20, 20);

    // Speed
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(`speed ${state.speed.toFixed(1)}`, w - 20, 52);

    // SPACE hint
    if (player.y >= groundY - player.height - 2 && !state.isOver) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowBlur = 0;
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
      ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.2 * pulse})`;
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.fillText('🔼 Hold SPACE to rise', w / 2, groundY - 10);
    }
  };

  // --- Keyboard controls ---
  const handleKeyDown = useCallback((e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      isSpaceHeldRef.current = true;
    }
  }, []);

  const handleKeyUp = useCallback((e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      isSpaceHeldRef.current = false;
    }
  }, []);

  // --- Restart / Next Level ---
  const handleRestart = () => {
    setScreen('start');
    setCurrentLevel(0);
  };

  const handleNextLevel = () => {
    if (currentLevel < LEVELS.length - 1) {
      startLevel(currentLevel + 1);
    } else {
      setScreen('allcomplete');
    }
  };

  // --- useEffect for keyboard ---
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [handleKeyDown, handleKeyUp]);

  // --- Resize canvas ---
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && screen === 'playing') {
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        const state = gameStateRef.current;
        state.groundY = canvas.height - 80;
        state.player.y = state.groundY - state.player.height;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [screen]);

  // --- When screen changes to playing, init game ---
  useEffect(() => {
    if (screen === 'playing' && canvasRef.current) {
      initGame(highScore, currentLevel);
    }
  }, [screen]);

  // ============================================================
  // RENDER SCREENS
  // ============================================================

  // ----- START SCREEN -----
  if (screen === 'start') {
    return (
      <>
        <Helmet>
          <title>Space Jump – Free Online Platformer</title>
          <meta name="description" content="Play Space Jump online for free. Jump through space, avoid obstacles, and complete levels!" />
        </Helmet>
        <div style={{ 
          padding: '40px 20px', 
          maxWidth: '600px', 
          margin: '0 auto', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh'
        }}>
          <h1 style={{ 
            fontSize: '48px', 
            marginBottom: '8px', 
            background: 'linear-gradient(135deg, #8ab4ff, #ff8a9a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            🚀 Space Jump
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px', fontSize: '18px' }}>
            Hold SPACE to rise, avoid obstacles, complete levels!
          </p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {LEVELS.map((lvl, idx) => (
              <div key={idx} style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '16px',
                padding: '24px',
                width: '200px',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: '0.3s',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>{lvl.id === 1 ? '🌱' : '🔥'}</div>
                <h3 style={{ color: lvl.color, margin: '0 0 4px' }}>{lvl.label}</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '12px' }}>{lvl.description}</p>
                <button 
                  onClick={() => startLevel(idx)} 
                  style={{
                    padding: '10px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: `linear-gradient(135deg, ${lvl.color}, ${lvl.color}dd)`,
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: '0.3s',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.04)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  Play
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '24px', color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
            🏆 Best Score: {highScore}
          </div>
        </div>
      </>
    );
  }

  // ----- PLAYING SCREEN -----
  if (screen === 'playing') {
    return (
      <>
        <Helmet>
          <title>Space Jump – Playing</title>
        </Helmet>
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050a1a', overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          <button 
            onClick={handleRestart} 
            style={{
              position: 'absolute',
              top: '16px',
              right: '20px',
              padding: '6px 16px',
              borderRadius: '30px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.3s',
              fontFamily: '"Segoe UI", sans-serif',
              zIndex: 10
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(255,70,70,0.15)'; e.target.style.borderColor = 'rgba(255,70,70,0.3)'; e.target.style.color = '#ff6b6b'; }}
            onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.color = 'rgba(255,255,255,0.5)'; }}
          >
            ✕ Exit
          </button>
        </div>
      </>
    );
  }

  // ----- GAME OVER -----
  if (screen === 'gameover') {
    const state = gameStateRef.current;
    const finalScore = Math.floor(state.score || 0);
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: '20px' }}>
        <div style={{ background: 'rgba(10,14,30,0.95)', borderRadius: '32px', padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', border: '1px solid rgba(255,100,100,0.2)' }}>
          <div style={{ fontSize: '60px' }}>💥</div>
          <h2 style={{ color: '#ff6b6b', fontSize: '28px' }}>GAME OVER</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '20px 0' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)' }}>Score</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{finalScore}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)' }}>Highest</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffd700' }}>{highScore}</div>
            </div>
          </div>
          <button onClick={handleRestart} style={{ padding: '14px 40px', borderRadius: '16px', border: 'none', background: '#4a7aff', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px', width: '100%' }}>🔄 Try Again</button>
          <Link to="/" style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: '16px', textDecoration: 'none' }}>🏠 Home</Link>
        </div>
      </div>
    );
  }

  // ----- LEVEL COMPLETE -----
  if (screen === 'levelcomplete') {
    const state = gameStateRef.current;
    const finalScore = Math.floor(state.score || 0);
    const isLastLevel = currentLevel === LEVELS.length - 1;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: '20px' }}>
        <div style={{ background: 'rgba(10,14,30,0.95)', borderRadius: '32px', padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', border: '1px solid rgba(100,200,255,0.2)' }}>
          <div style={{ fontSize: '60px' }}>{isLastLevel ? '🏆' : '🎉'}</div>
          <h2 style={{ color: '#6bcbff', fontSize: '28px' }}>{isLastLevel ? 'All Levels Complete!' : `${LEVELS[currentLevel].label} Complete!`}</h2>
          <div style={{ margin: '20px 0' }}>
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>Score</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{finalScore}</div>
          </div>
          {!isLastLevel ? (
            <button onClick={handleNextLevel} style={{ padding: '14px 40px', borderRadius: '16px', border: 'none', background: '#4a7aff', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px', width: '100%' }}>➡️ Next Level</button>
          ) : (
            <button onClick={handleRestart} style={{ padding: '14px 40px', borderRadius: '16px', border: 'none', background: '#4a7aff', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px', width: '100%' }}>🔄 Play Again</button>
          )}
          <Link to="/" style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: '16px', textDecoration: 'none' }}>🏠 Home</Link>
        </div>
      </div>
    );
  }

  // ----- ALL COMPLETE (after level 2) -----
  if (screen === 'allcomplete') {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a', padding: '20px' }}>
        <div style={{ background: 'rgba(10,14,30,0.95)', borderRadius: '32px', padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center', border: '1px solid rgba(255,215,0,0.3)' }}>
          <div style={{ fontSize: '60px' }}>👑</div>
          <h2 style={{ color: '#ffd700', fontSize: '28px' }}>You're a Space Master!</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', margin: '12px 0 24px' }}>You completed both levels!</p>
          <button onClick={handleRestart} style={{ padding: '14px 40px', borderRadius: '16px', border: 'none', background: '#4a7aff', color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px', width: '100%' }}>🔄 Play Again</button>
          <Link to="/" style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: '16px', textDecoration: 'none' }}>🏠 Home</Link>
        </div>
      </div>
    );
  }

  return null;
}