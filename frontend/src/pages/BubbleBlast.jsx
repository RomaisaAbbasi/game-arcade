import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { updateScore } from '../utils/api';
import './BubbleBlast.css';

// ============================================================
// CONFIGURATION
// ============================================================
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFD93D', '#6C5CE7', '#FD79A8'];
const BUBBLE_RADIUS = 22;
const GAP = 2;
const COLS = 8;
const SHOOTER_SPEED = 700;
const WALL_BOUNCE_ANGLE = 0.85;
const DEFAULT_SHOTS = 30;
const MISS_THRESHOLD = 5;

// ============================================================
// LEVEL CONFIGURATIONS
// ============================================================
const LEVEL_CONFIGS = [
  { level: 1, colors: 4, rows: 5, shots: 30, missThreshold: 5 },
  { level: 2, colors: 4, rows: 6, shots: 28, missThreshold: 4 },
  { level: 3, colors: 5, rows: 6, shots: 26, missThreshold: 4 },
  { level: 4, colors: 5, rows: 7, shots: 24, missThreshold: 3 },
  { level: 5, colors: 6, rows: 7, shots: 22, missThreshold: 3 },
  { level: 6, colors: 6, rows: 8, shots: 20, missThreshold: 2 },
];

// ============================================================
// LEVEL GENERATOR
// ============================================================
const generateLevel = (level) => {
  const config = LEVEL_CONFIGS[Math.min(level - 1, LEVEL_CONFIGS.length - 1)];
  const rows = config.rows;
  const colors = config.colors;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    const cols = r % 2 === 0 ? COLS : COLS - 1;
    for (let c = 0; c < cols; c++) {
      row.push({
        color: COLORS[Math.floor(Math.random() * colors)],
        row: r,
        col: c,
      });
    }
    grid.push(row);
  }
  return grid;
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function BubbleBlast({ user }) {
  // --- State ---
  const [gameState, setGameState] = useState('menu'); // menu | playing | gameover | levelcomplete
  const [level, setLevel] = useState(1);
  const [grid, setGrid] = useState([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(DEFAULT_SHOTS);
  const [missCount, setMissCount] = useState(0);
  const [currentBubble, setCurrentBubble] = useState(null);
  const [nextBubble, setNextBubble] = useState(null);
  const [aimAngle, setAimAngle] = useState(-Math.PI / 2);
  const [aimLine, setAimLine] = useState([]);
  const [showAim, setShowAim] = useState(true);
  const [shooting, setShooting] = useState(false);
  const [particles, setParticles] = useState([]);
  const [comboPopup, setComboPopup] = useState(null);
  const [dropBonus, setDropBonus] = useState(null);
  const [levelCompleteData, setLevelCompleteData] = useState(null);
  const [gameOverData, setGameOverData] = useState(null);

  // --- Refs ---
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const shooterPos = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });
  const gridRef = useRef([]);
  const projectileRef = useRef(null);
  const gameLoopRunning = useRef(false);

  // --- Best score from backend ---
  const backendBest = user?.scores?.bubbleBlast?.bestScore || 0;
  useEffect(() => {
    if (backendBest > bestScore) setBestScore(backendBest);
  }, [backendBest]);

  // --- Save score ---
  const saveScore = async (finalScore, lvl, stars) => {
    try {
      await updateScore(user.name, 'bubbleBlast', {
        bestScore: Math.max(bestScore, finalScore),
        highestLevel: Math.max(level, lvl || 1),
        totalStars: (user?.scores?.bubbleBlast?.totalStars || 0) + (stars || 0),
        gamesPlayed: (user?.scores?.bubbleBlast?.gamesPlayed || 0) + 1,
      });
    } catch (err) {
      console.error('Failed to save bubble blast score:', err);
    }
  };

  // --- Start level ---
  const startLevel = (lvl) => {
    setLevel(lvl);
    const config = LEVEL_CONFIGS[Math.min(lvl - 1, LEVEL_CONFIGS.length - 1)];
    const newGrid = generateLevel(lvl);
    gridRef.current = newGrid;
    setGrid(newGrid);
    setScore(0);
    setCombo(0);
    setShotsLeft(config.shots || DEFAULT_SHOTS);
    setMissCount(0);
    setComboPopup(null);
    setDropBonus(null);
    setParticles([]);
    setShowAim(true);
    setShooting(false);
    setLevelCompleteData(null);
    setGameOverData(null);
    setGameState('playing');
    // Create current and next bubbles
    const colors = config.colors;
    const getRandomColor = () => COLORS[Math.floor(Math.random() * colors)];
    setCurrentBubble({ color: getRandomColor() });
    setNextBubble({ color: getRandomColor() });
    // Reset shooter position
    const canvas = canvasRef.current;
    if (canvas) {
      shooterPos.current = { x: canvas.width / 2, y: canvas.height - 70 };
    }
    gameLoopRunning.current = true;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    lastTimeRef.current = performance.now();
    gameLoop(performance.now());
  };

  // --- Update aim ---
  const updateAim = (x, y) => {
    if (gameState !== 'playing' || shooting) return;
    const dx = x - shooterPos.current.x;
    const dy = y - shooterPos.current.y;
    if (dx === 0 && dy === 0) return;
    let angle = Math.atan2(dy, dx);
    // Clamp to prevent shooting downward
    if (angle > -0.1) angle = -0.1;
    if (angle < -Math.PI + 0.1) angle = -Math.PI + 0.1;
    setAimAngle(angle);
    // Calculate trajectory with wall bounce
    const line = calculateTrajectory(shooterPos.current.x, shooterPos.current.y, angle);
    setAimLine(line);
  };

  // --- Calculate trajectory (with wall bounce) ---
  const calculateTrajectory = (startX, startY, angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const line = [];
    const steps = 30;
    const stepSize = 15;
    let curX = startX;
    let curY = startY;
    let dirX = Math.cos(angle);
    let dirY = Math.sin(angle);
    for (let i = 0; i < steps; i++) {
      curX += dirX * stepSize;
      curY += dirY * stepSize;
      // Wall bounce
      if (curX < 10 || curX > canvas.width - 10) {
        dirX = -dirX;
        curX += dirX * stepSize * 0.5;
        // Add a reflected point
        line.push({ x: curX, y: curY, reflect: true });
      }
      if (curY < 0) break;
      line.push({ x: curX, y: curY, reflect: false });
    }
    return line;
  };

  // --- Shoot ---
  const shoot = () => {
    if (gameState !== 'playing' || shooting || !currentBubble || shotsLeft <= 0) return;
    setShooting(true);
    setShowAim(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const startX = shooterPos.current.x;
    const startY = shooterPos.current.y;
    const angle = aimAngle;
    const speed = SHOOTER_SPEED;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const bubble = {
      ...currentBubble,
      x: startX,
      y: startY,
      vx: dirX * speed,
      vy: dirY * speed,
    };
    projectileRef.current = bubble;
    setShotsLeft(prev => prev - 1);
    // Animate shot
    let shotFrame = 0;
    const maxFrames = 100;
    const shootInterval = setInterval(() => {
      shotFrame++;
      const dt = 0.016;
      bubble.x += bubble.vx * dt;
      bubble.y += bubble.vy * dt;
      // Wall bounce
      if (bubble.x < BUBBLE_RADIUS) {
        bubble.x = BUBBLE_RADIUS;
        bubble.vx = Math.abs(bubble.vx) * WALL_BOUNCE_ANGLE;
      }
      if (bubble.x > canvas.width - BUBBLE_RADIUS) {
        bubble.x = canvas.width - BUBBLE_RADIUS;
        bubble.vx = -Math.abs(bubble.vx) * WALL_BOUNCE_ANGLE;
      }
      // Check if bubble reaches top or cluster
      if (bubble.y < BUBBLE_RADIUS || shotFrame > maxFrames) {
        clearInterval(shootInterval);
        attachBubble(bubble);
        return;
      }
      // Check collision with existing bubbles
      const attachPos = findAttachPosition(bubble.x, bubble.y);
      if (attachPos) {
        clearInterval(shootInterval);
        attachBubbleToGrid(bubble, attachPos);
        return;
      }
      renderGame();
    }, 16);
  };

  // --- Find attach position ---
  const findAttachPosition = (x, y) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const gridHeight = 50;
    const startY = 20;
    for (let r = 0; r < gridRef.current.length; r++) {
      const row = gridRef.current[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (!row[c]) continue;
        const cx = c * (BUBBLE_RADIUS * 2 + GAP) + (r % 2 === 0 ? 0 : BUBBLE_RADIUS + GAP / 2);
        const cy = startY + r * (BUBBLE_RADIUS * 2 + GAP);
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < BUBBLE_RADIUS * 1.8) {
          return { row: r, col: c };
        }
      }
    }
    // Check if near ceiling (top)
    if (y < 60) {
      return { row: 0, col: Math.floor(x / (BUBBLE_RADIUS * 2 + GAP)) };
    }
    return null;
  };

  // --- Attach bubble to grid ---
  const attachBubbleToGrid = (bubble, pos) => {
    const { row, col } = pos;
    const newGrid = [...gridRef.current];
    if (!newGrid[row]) newGrid[row] = [];
    // Check if position is empty
    if (newGrid[row][col]) {
      // Find nearest empty spot
      const fallback = findNearestEmpty(row, col);
      if (fallback) {
        if (!newGrid[fallback.row]) newGrid[fallback.row] = [];
        newGrid[fallback.row][fallback.col] = { color: bubble.color, row: fallback.row, col: fallback.col };
      } else {
        // Could not place – game over
        handleGameOver();
        return;
      }
    } else {
      newGrid[row][col] = { color: bubble.color, row, col };
    }
    gridRef.current = newGrid;
    setGrid(newGrid);
    // Check matches
    const matches = findMatches(row, col, bubble.color);
    if (matches.length >= 3) {
      handlePop(matches);
    } else {
      // No match
      setCombo(0);
      setMissCount(prev => prev + 1);
      // Check if new row needed
      if (missCount >= MISS_THRESHOLD) {
        addNewRow();
        setMissCount(0);
      }
      // Update current/next
      const config = LEVEL_CONFIGS[Math.min(level - 1, LEVEL_CONFIGS.length - 1)];
      const colors = config.colors;
      setCurrentBubble(nextBubble);
      setNextBubble({ color: COLORS[Math.floor(Math.random() * colors)] });
      setShooting(false);
      setShowAim(true);
      renderGame();
      // Check if shots left
      if (shotsLeft <= 0) {
        handleGameOver();
      }
    }
  };

  // --- Find nearest empty grid position ---
  const findNearestEmpty = (row, col) => {
    for (let r = 0; r < gridRef.current.length + 2; r++) {
      for (let c = 0; c < (r % 2 === 0 ? COLS : COLS - 1); c++) {
        if (!gridRef.current[r] || !gridRef.current[r][c]) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  };

  // --- Match detection (BFS) ---
  const findMatches = (row, col, color) => {
    const visited = new Set();
    const queue = [{ r: row, c: col }];
    const matches = [];
    while (queue.length) {
      const { r, c } = queue.shift();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (!gridRef.current[r] || !gridRef.current[r][c] || gridRef.current[r][c].color !== color) continue;
      matches.push({ r, c });
      const neighbors = getNeighbors(r, c);
      for (const n of neighbors) {
        if (!visited.has(`${n.r},${n.c}`)) queue.push(n);
      }
    }
    return matches;
  };

  // --- Get neighbors (hex grid) ---
  const getNeighbors = (r, c) => {
    const dirs = r % 2 === 0
      ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    const result = [];
    for (const d of dirs) {
      const nr = r + d[0];
      const nc = c + d[1];
      if (nr >= 0 && nr < gridRef.current.length && nc >= 0 && nc < (gridRef.current[nr]?.length || 0)) {
        if (gridRef.current[nr][nc]) {
          result.push({ r: nr, c: nc });
        }
      }
    }
    return result;
  };

  // --- Pop handler ---
  const handlePop = (matches) => {
    const newGrid = [...gridRef.current];
    const removeSet = new Set(matches.map(m => `${m.r},${m.c}`));
    for (const m of matches) {
      if (newGrid[m.r]) {
        newGrid[m.r][m.c] = null;
      }
    }
    // Clean up rows
    for (let r = 0; r < newGrid.length; r++) {
      newGrid[r] = newGrid[r]?.filter(b => b !== null) || [];
      if (newGrid[r].length === 0) {
        newGrid.splice(r, 1);
        r--;
      }
    }
    gridRef.current = newGrid;
    setGrid(newGrid);
    // Score
    const popCount = matches.length;
    const baseScore = popCount * 10;
    const comboBonus = combo * 5;
    const totalAdd = baseScore + comboBonus;
    setScore(prev => prev + totalAdd);
    setCombo(prev => prev + 1);
    // Particles
    spawnParticles(matches);
    // Combo popup
    if (combo > 0) {
      setComboPopup(`🔥 COMBO x${combo + 1}`);
      setTimeout(() => setComboPopup(null), 800);
    }
    // Check floating bubbles
    const floating = findFloatingBubbles();
    if (floating.length > 0) {
      dropBubbles(floating);
    }
    // Check level complete
    if (newGrid.length === 0 || newGrid.every(row => row.length === 0)) {
      handleLevelComplete();
      return;
    }
    // Update next bubble
    const config = LEVEL_CONFIGS[Math.min(level - 1, LEVEL_CONFIGS.length - 1)];
    const colors = config.colors;
    setCurrentBubble(nextBubble);
    setNextBubble({ color: COLORS[Math.floor(Math.random() * colors)] });
    setShooting(false);
    setShowAim(true);
    renderGame();
  };

  // --- Find floating bubbles ---
  const findFloatingBubbles = () => {
    const connected = new Set();
    const queue = [];
    // Start from top row
    if (gridRef.current.length > 0) {
      for (let c = 0; c < gridRef.current[0]?.length || 0; c++) {
        if (gridRef.current[0] && gridRef.current[0][c]) {
          const key = `0,${c}`;
          if (!connected.has(key)) {
            connected.add(key);
            queue.push({ r: 0, c });
          }
        }
      }
    }
    while (queue.length) {
      const { r, c } = queue.shift();
      const neighbors = getNeighbors(r, c);
      for (const n of neighbors) {
        const key = `${n.r},${n.c}`;
        if (!connected.has(key) && gridRef.current[n.r] && gridRef.current[n.r][n.c]) {
          connected.add(key);
          queue.push(n);
        }
      }
    }
    const floating = [];
    for (let r = 0; r < gridRef.current.length; r++) {
      for (let c = 0; c < (gridRef.current[r]?.length || 0); c++) {
        if (gridRef.current[r] && gridRef.current[r][c] && !connected.has(`${r},${c}`)) {
          floating.push({ r, c });
        }
      }
    }
    return floating;
  };

  // --- Drop floating bubbles ---
  const dropBubbles = (floating) => {
    const newGrid = [...gridRef.current];
    for (const f of floating) {
      if (newGrid[f.r]) {
        newGrid[f.r][f.c] = null;
      }
    }
    for (let r = 0; r < newGrid.length; r++) {
      newGrid[r] = newGrid[r]?.filter(b => b !== null) || [];
      if (newGrid[r].length === 0) {
        newGrid.splice(r, 1);
        r--;
      }
    }
    gridRef.current = newGrid;
    setGrid(newGrid);
    const bonus = floating.length * 50;
    setScore(prev => prev + bonus);
    setDropBonus(`💥 DROP BONUS! +${bonus}`);
    setTimeout(() => setDropBonus(null), 1000);
    spawnParticles(floating);
  };

  // --- Add new row ---
  const addNewRow = () => {
    const config = LEVEL_CONFIGS[Math.min(level - 1, LEVEL_CONFIGS.length - 1)];
    const colors = config.colors;
    const newRow = [];
    const cols = gridRef.current.length % 2 === 0 ? COLS : COLS - 1;
    for (let c = 0; c < cols; c++) {
      newRow.push({
        color: COLORS[Math.floor(Math.random() * colors)],
        row: gridRef.current.length,
        col: c,
      });
    }
    gridRef.current.push(newRow);
    setGrid(gridRef.current);
    setComboPopup('⚠️ NEW ROW!');
    setTimeout(() => setComboPopup(null), 1000);
    // Check if too high (game over)
    if (gridRef.current.length > 10) {
      handleGameOver();
    }
    renderGame();
  };

  // --- Handle level complete ---
  const handleLevelComplete = () => {
    gameLoopRunning.current = false;
    setGameState('levelcomplete');
    const stars = combo >= 5 ? 3 : combo >= 3 ? 2 : 1;
    const finalScore = score;
    const data = { score: finalScore, level, stars, combo, shotsUsed: DEFAULT_SHOTS - shotsLeft };
    setLevelCompleteData(data);
    saveScore(finalScore, level, stars);
  };

  // --- Handle game over ---
  const handleGameOver = () => {
    gameLoopRunning.current = false;
    setGameState('gameover');
    const finalScore = score;
    setGameOverData({ score: finalScore, level, shotsUsed: DEFAULT_SHOTS - shotsLeft });
    saveScore(finalScore, level, 0);
  };

  // --- Spawn particles ---
  const spawnParticles = (positions) => {
    const newParticles = [];
    for (const p of positions) {
      const row = p.r;
      const col = p.c;
      const cx = col * (BUBBLE_RADIUS * 2 + GAP) + (row % 2 === 0 ? 0 : BUBBLE_RADIUS + GAP / 2);
      const cy = 20 + row * (BUBBLE_RADIUS * 2 + GAP);
      for (let i = 0; i < 6; i++) {
        newParticles.push({
          x: cx,
          y: cy,
          vx: (Math.random() - 0.5) * 150,
          vy: (Math.random() - 0.5) * 150 - 50,
          life: 1,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 3 + Math.random() * 5,
        });
      }
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  // --- Render game on canvas ---
  const renderGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0e2a');
    grad.addColorStop(0.5, '#1a1a4a');
    grad.addColorStop(1, '#2a1a5a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Grid bubbles
    const gridHeight = 50;
    const startY = 20;
    const radius = BUBBLE_RADIUS;
    for (let r = 0; r < gridRef.current.length; r++) {
      const row = gridRef.current[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const bubble = row[c];
        if (!bubble) continue;
        const cx = c * (radius * 2 + GAP) + (r % 2 === 0 ? 0 : radius + GAP / 2);
        const cy = startY + r * (radius * 2 + GAP);
        drawBubble(ctx, cx, cy, radius, bubble.color);
      }
    }

    // Shooter
    const sx = shooterPos.current.x;
    const sy = shooterPos.current.y;
    drawShooter(ctx, sx, sy, aimAngle);

    // Current bubble on shooter
    if (currentBubble && !shooting && gameState === 'playing') {
      drawBubble(ctx, sx, sy - 30, radius * 0.8, currentBubble.color);
    }

    // Next bubble
    if (nextBubble && gameState === 'playing') {
      const nx = W - 70;
      const ny = 20;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '12px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NEXT', nx, ny + 10);
      drawBubble(ctx, nx, ny + 40, radius * 0.7, nextBubble.color);
    }

    // Aim line
    if (showAim && !shooting && gameState === 'playing') {
      ctx.setLineDash([6, 10]);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      for (const p of aimLine) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Draw reflection dots
      for (const p of aimLine) {
        if (p.reflect) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Projectile
    if (projectileRef.current && shooting) {
      const p = projectileRef.current;
      drawBubble(ctx, p.x, p.y, radius * 0.9, p.color);
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Combo popup
    if (comboPopup) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 28px Poppins, sans-serif';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 20;
      ctx.fillText(comboPopup, W/2, 120);
      ctx.shadowBlur = 0;
    }

    // Drop bonus
    if (dropBonus) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#48E6A8';
      ctx.font = 'bold 24px Poppins, sans-serif';
      ctx.shadowColor = '#48E6A8';
      ctx.shadowBlur = 20;
      ctx.fillText(dropBonus, W/2, 180);
      ctx.shadowBlur = 0;
    }

    // HUD
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Poppins, sans-serif';
    ctx.fillText(`LEVEL ${level}`, 15, 15);
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`SCORE ${score}`, 15, 45);
    ctx.fillStyle = '#aaa';
    ctx.font = '14px Poppins, sans-serif';
    ctx.fillText(`BEST ${bestScore}`, 15, 75);
    ctx.fillStyle = '#6bcbff';
    ctx.fillText(`SHOTS ${shotsLeft}`, 15, 105);
    // Miss indicator
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '12px Poppins, sans-serif';
    const missDots = '●'.repeat(missCount) + '○'.repeat(MISS_THRESHOLD - missCount);
    ctx.fillText(`MISSES ${missDots}`, 15, 130);

    // Danger line
    const dangerY = H - 120;
    if (gridRef.current.length > 6) {
      ctx.strokeStyle = `rgba(255,0,0,${0.2 + 0.3 * Math.sin(Date.now() / 300)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(20, dangerY);
      ctx.lineTo(W - 20, dangerY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,0,0,0.3)';
      ctx.font = '12px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ DANGER', W/2, dangerY - 10);
    }
  };

  // --- Draw bubble helper ---
  const drawBubble = (ctx, x, y, radius, color) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    const grad = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.1, x, y, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, color);
    grad.addColorStop(0.8, color);
    grad.addColorStop(1, '#00000033');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(x - radius*0.25, y - radius*0.25, radius*0.2, 0, Math.PI * 2);
    ctx.fill();
  };

  // --- Draw shooter helper ---
  const drawShooter = (ctx, x, y, angle) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = '#7C5CFF';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#4a7aff';
    ctx.strokeStyle = '#7C5CFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6C5CE7';
    ctx.fillRect(-5, -28, 10, 28);
    ctx.strokeRect(-5, -28, 10, 28);
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  // --- Game loop ---
  const gameLoop = (timestamp) => {
    if (!gameLoopRunning.current) {
      renderGame();
      return;
    }
    // Update particles
    setParticles(prev => {
      const updated = prev.map(p => {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        p.life -= 0.02;
        return p;
      });
      return updated.filter(p => p.life > 0);
    });
    renderGame();
    animFrameRef.current = requestAnimationFrame(gameLoop);
  };

  // --- Resize canvas ---
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width || 600;
    canvas.height = rect.height || 700;
    shooterPos.current = { x: canvas.width / 2, y: canvas.height - 70 };
  }, []);

  useLayoutEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // --- Mouse/Touch events ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handlePointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      mouseRef.current = { x, y };
      if (gameState === 'playing' && !shooting) {
        updateAim(x, y);
      }
    };
    const handlePointerDown = (e) => {
      if (gameState === 'playing' && !shooting) {
        shoot();
      }
    };
    const handleTouchStart = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
      const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
      mouseRef.current = { x, y };
      if (gameState === 'playing' && !shooting) {
        updateAim(x, y);
        shoot();
      }
    };
    const handleTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
      const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
      mouseRef.current = { x, y };
      if (gameState === 'playing' && !shooting) {
        updateAim(x, y);
      }
    };
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [gameState, shooting]);

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      gameLoopRunning.current = false;
    };
  }, []);

  // ============================================================
  // RENDER SCREENS
  // ============================================================

  if (gameState === 'menu') {
    return (
      <>
        <Helmet>
          <title>Bubble Blast – Free Bubble Shooter Game</title>
          <meta name="description" content="Play Bubble Blast online for free. Aim, match colorful bubbles, create combos and clear challenging levels." />
        </Helmet>
        <div className="bb-menu">
          <h1>🫧 Bubble Blast</h1>
          <p>Aim. Match. Pop.</p>
          <div className="bb-menu-stats">
            <div>🏆 Best Score: {bestScore}</div>
            <div>🎯 Highest Level: {user?.scores?.bubbleBlast?.highestLevel || 1}</div>
          </div>
          <button className="bb-play-btn" onClick={() => startLevel(1)}>🚀 Start Game</button>
        </div>
      </>
    );
  }

  if (gameState === 'playing') {
    return (
      <>
        <Helmet><title>Bubble Blast – Playing</title></Helmet>
        <div ref={containerRef} className="bb-game">
          <canvas ref={canvasRef} className="bb-canvas" />
        </div>
      </>
    );
  }

  if (gameState === 'levelcomplete' && levelCompleteData) {
    const { score: finalScore, level: lvl, stars, combo: cmb, shotsUsed } = levelCompleteData;
    return (
      <>
        <Helmet><title>Bubble Blast – Level Complete</title></Helmet>
        <div ref={containerRef} className="bb-game">
          <canvas ref={canvasRef} className="bb-canvas" />
          <div className="bb-overlay">
            <div className="bb-modal">
              <h2>🎉 Level Complete!</h2>
              <p>You cleared all bubbles!</p>
              <div className="bb-stats">
                <div><span>Score</span><strong>{finalScore}</strong></div>
                <div><span>Stars</span><strong>{'⭐'.repeat(stars)}{'☆'.repeat(3-stars)}</strong></div>
                <div><span>Combo</span><strong>{cmb}x</strong></div>
                <div><span>Shots Used</span><strong>{shotsUsed}</strong></div>
              </div>
              <button className="bb-next-btn" onClick={() => startLevel(lvl + 1)}>➡️ Next Level</button>
              <button className="bb-menu-btn" onClick={() => setGameState('menu')}>🏠 Menu</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (gameState === 'gameover' && gameOverData) {
    const { score: finalScore, level: lvl, shotsUsed } = gameOverData;
    return (
      <>
        <Helmet><title>Bubble Blast – Game Over</title></Helmet>
        <div ref={containerRef} className="bb-game">
          <canvas ref={canvasRef} className="bb-canvas" />
          <div className="bb-overlay">
            <div className="bb-modal">
              <h2>💥 Game Over</h2>
              <p>Too many bubbles reached the bottom.</p>
              <div className="bb-stats">
                <div><span>Score</span><strong>{finalScore}</strong></div>
                <div><span>Level</span><strong>{lvl}</strong></div>
                <div><span>Shots Used</span><strong>{shotsUsed}</strong></div>
              </div>
              <button className="bb-retry-btn" onClick={() => startLevel(lvl)}>🔄 Retry</button>
              <button className="bb-menu-btn" onClick={() => setGameState('menu')}>🏠 Menu</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}