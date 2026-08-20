import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { updateScore } from '../utils/api';
import './CozyCakeFactory.css';


// ============================================================
// CONFIGURATION
// ============================================================
const LEVELS = [
  { level: 1, ordersRequired: 5, maxMistakes: 3, timePerOrder: 30, 
    shapes: ['round', 'square'], 
    flavors: ['strawberry', 'chocolate', 'vanilla'],
    maxLayers: 2,
    frostingOptions: ['vanilla', 'chocolate'],
    decorations: ['none'],
    sprinkles: ['none'],
    label: 'Simple Cakes' },
  { level: 2, ordersRequired: 6, maxMistakes: 3, timePerOrder: 25,
    shapes: ['round', 'square', 'heart'],
    flavors: ['strawberry', 'chocolate', 'vanilla', 'lemon'],
    maxLayers: 3,
    frostingOptions: ['vanilla', 'chocolate', 'strawberry'],
    decorations: ['strawberry', 'cherry'],
    sprinkles: ['none', 'pink'],
    label: 'Fancy Cakes' },
  { level: 3, ordersRequired: 7, maxMistakes: 2, timePerOrder: 22,
    shapes: ['round', 'square', 'heart', 'star'],
    flavors: ['strawberry', 'chocolate', 'vanilla', 'lemon', 'blueberry'],
    maxLayers: 3,
    frostingOptions: ['vanilla', 'chocolate', 'strawberry', 'blueberry'],
    decorations: ['strawberry', 'cherry', 'blueberry', 'flower'],
    sprinkles: ['none', 'pink', 'rainbow', 'chocolate'],
    label: 'Gourmet Cakes' },
  { level: 4, ordersRequired: 8, maxMistakes: 2, timePerOrder: 18,
    shapes: ['round', 'square', 'heart', 'star', 'flower'],
    flavors: ['strawberry', 'chocolate', 'vanilla', 'lemon', 'blueberry', 'coconut'],
    maxLayers: 4,
    frostingOptions: ['vanilla', 'chocolate', 'strawberry', 'blueberry', 'lemon'],
    decorations: ['strawberry', 'cherry', 'blueberry', 'flower', 'chocolate_piece'],
    sprinkles: ['none', 'pink', 'rainbow', 'chocolate', 'gold'],
    label: 'Master Cakes' },
  { level: 5, ordersRequired: 10, maxMistakes: 2, timePerOrder: 15,
    shapes: ['round', 'square', 'heart', 'star', 'flower', 'diamond'],
    flavors: ['strawberry', 'chocolate', 'vanilla', 'lemon', 'blueberry', 'coconut'],
    maxLayers: 5,
    frostingOptions: ['vanilla', 'chocolate', 'strawberry', 'blueberry', 'lemon', 'caramel'],
    decorations: ['strawberry', 'cherry', 'blueberry', 'flower', 'chocolate_piece', 'candle', 'sugar_pearl'],
    sprinkles: ['none', 'pink', 'rainbow', 'chocolate', 'gold', 'white'],
    label: 'Legendary Cakes' }
];

const SHAPE_ICONS = {
  round: '⭕',
  square: '⬜',
  heart: '❤️',
  star: '⭐',
  flower: '🌸',
  diamond: '💎'
};

const FLAVOR_COLORS = {
  strawberry: '#ff8a9a',
  chocolate: '#8d6b4a',
  vanilla: '#f5e6d3',
  lemon: '#ffd93d',
  blueberry: '#6c5ce7',
  coconut: '#f0e6d3',
  caramel: '#d4a373'
};

const FROSTING_COLORS = {
  vanilla: '#f5e6d3',
  chocolate: '#8d6b4a',
  strawberry: '#ff8a9a',
  blueberry: '#6c5ce7',
  lemon: '#ffd93d',
  caramel: '#d4a373'
};

const DECORATION_ICONS = {
  strawberry: '🍓',
  cherry: '🍒',
  blueberry: '🫐',
  flower: '🌸',
  chocolate_piece: '🍫',
  candle: '🕯️',
  sugar_pearl: '⚪',
  none: ''
};

const SPRINKLE_COLORS = {
  pink: '#ff8a9a',
  rainbow: 'rainbow',
  chocolate: '#8d6b4a',
  gold: '#ffd700',
  white: '#ffffff',
  blue: '#6c5ce7',
  none: ''
};

// ============================================================
// ORDER GENERATOR
// ============================================================
const generateOrder = (levelConfig) => {
  const numLayers = Math.floor(Math.random() * (levelConfig.maxLayers - 1)) + 2;
  const layerColors = [];
  for (let i = 0; i < numLayers; i++) {
    const flavor = levelConfig.flavors[Math.floor(Math.random() * levelConfig.flavors.length)];
    layerColors.push(flavor);
  }
  
  return {
    shape: levelConfig.shapes[Math.floor(Math.random() * levelConfig.shapes.length)],
    flavor: levelConfig.flavors[Math.floor(Math.random() * levelConfig.flavors.length)],
    layers: numLayers,
    layerColors: layerColors,
    frosting: levelConfig.frostingOptions[Math.floor(Math.random() * levelConfig.frostingOptions.length)],
    decoration: levelConfig.decorations[Math.floor(Math.random() * levelConfig.decorations.length)],
    sprinkles: levelConfig.sprinkles[Math.floor(Math.random() * levelConfig.sprinkles.length)],
  };
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CozyCakeFactory({ user }) {
  // --- State ---
  const [gameState, setGameState] = useState('start'); // start | playing | paused | levelComplete | gameOver | victory
  const [levelIndex, setLevelIndex] = useState(0);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState(0);
  const [requiredOrders, setRequiredOrders] = useState(5);
  const [perfectCakes, setPerfectCakes] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [maxMistakes, setMaxMistakes] = useState(3);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highestCombo, setHighestCombo] = useState(0);
  const [efficiency, setEfficiency] = useState(100);
  const [timer, setTimer] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [timeWarning, setTimeWarning] = useState(false);

  // --- Cake Building State ---
  const [selectedShape, setSelectedShape] = useState('round');
  const [selectedFlavor, setSelectedFlavor] = useState('vanilla');
  const [selectedLayers, setSelectedLayers] = useState([]);
  const [selectedFrosting, setSelectedFrosting] = useState('vanilla');
  const [selectedDecoration, setSelectedDecoration] = useState('none');
  const [selectedSprinkles, setSelectedSprinkles] = useState('none');

  // --- UI State ---
  const [activeStation, setActiveStation] = useState('pan');
  const [showOrder, setShowOrder] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [resultType, setResultType] = useState('');
  const [showAchievement, setShowAchievement] = useState(null);
  const [particles, setParticles] = useState([]);
  const [confettiActive, setConfettiActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // --- Refs ---
  const timerInterval = useRef(null);
  const stationTimeout = useRef(null);
  const particleTimeout = useRef(null);

  // --- Best scores ---
  const backendBest = user?.scores?.cozyCakeFactory?.bestScore || 0;
  const backendHighestLevel = user?.scores?.cozyCakeFactory?.highestLevel || 0;

  useEffect(() => {
    if (backendBest > bestScore) {
      setBestScore(backendBest);
    }
    if (backendHighestLevel > levelIndex) {
      setLevelIndex(backendHighestLevel);
    }
  }, [backendBest, backendHighestLevel]);

  // --- Level setup ---
  const setupLevel = (idx) => {
    const config = LEVELS[idx];
    setRequiredOrders(config.ordersRequired);
    setMaxMistakes(config.maxMistakes);
    setMistakes(0);
    setCompletedOrders(0);
    setPerfectCakes(0);
    setCombo(0);
    setHighestCombo(0);
    setEfficiency(100);
    setTimer(config.timePerOrder);
    setTimerActive(false);
    setShowOrder(false);
    setShowResult(false);
    setActiveStation('pan');
    setGameState('playing');
    setIsPaused(false);
    setParticles([]);
    setConfettiActive(false);
    generateNewOrder(idx);
  };

  // --- Generate new order ---
  const generateNewOrder = (idx) => {
    const config = LEVELS[idx];
    const newOrder = generateOrder(config);
    setCurrentOrder(newOrder);
    setTimer(config.timePerOrder);
    setTimerActive(true);
    setShowOrder(true);
    setActiveStation('pan');
    // Reset cake selections
    setSelectedShape(newOrder.shape);
    setSelectedFlavor(newOrder.flavor);
    setSelectedLayers([]);
    setSelectedFrosting(newOrder.frosting);
    setSelectedDecoration(newOrder.decoration);
    setSelectedSprinkles(newOrder.sprinkles);
  };

  // --- Timer logic ---
  useEffect(() => {
    if (timerActive && gameState === 'playing') {
      if (timerInterval.current) clearInterval(timerInterval.current);
      timerInterval.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerInterval.current);
            // Time's up - move to validation
            validateCake(false);
            return 0;
          }
          setTimeWarning(prev <= 5);
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [timerActive, gameState]);

  // --- Station progression ---
  const nextStation = () => {
    const stations = ['pan', 'batter', 'layers', 'frosting', 'decoration', 'sprinkles', 'packaging'];
    const currentIndex = stations.indexOf(activeStation);
    if (currentIndex < stations.length - 1) {
      setActiveStation(stations[currentIndex + 1]);
    }
  };

  // --- Build cake - layer addition ---
  const addLayer = (flavor) => {
    if (selectedLayers.length < currentOrder?.layers || 0) {
      setSelectedLayers([...selectedLayers, flavor]);
    }
  };

  const removeLastLayer = () => {
    if (selectedLayers.length > 0) {
      setSelectedLayers(selectedLayers.slice(0, -1));
    }
  };

  // --- Validate cake ---
  const validateCake = (submitted = true) => {
    if (!currentOrder) return;
    setTimerActive(false);
    if (timerInterval.current) clearInterval(timerInterval.current);

    const errors = [];
    if (selectedShape !== currentOrder.shape) errors.push('Shape');
    if (selectedFlavor !== currentOrder.flavor) errors.push('Flavor');
    if (selectedLayers.length !== currentOrder.layers) errors.push('Layer count');
    else {
      for (let i = 0; i < selectedLayers.length; i++) {
        if (selectedLayers[i] !== currentOrder.layerColors[i]) {
          errors.push('Layer color order');
          break;
        }
      }
    }
    if (selectedFrosting !== currentOrder.frosting) errors.push('Frosting');
    if (selectedDecoration !== currentOrder.decoration) errors.push('Decoration');
    if (selectedSprinkles !== currentOrder.sprinkles) errors.push('Sprinkles');

    if (errors.length === 0) {
      // PERFECT CAKE!
      handlePerfectCake();
    } else {
      handleIncorrectCake(errors);
    }
  };

  // --- Perfect cake handler ---
  const handlePerfectCake = () => {
    const config = LEVELS[levelIndex];
    const bonus = 250;
    const timeBonus = Math.max(0, Math.floor(timer * 10));
    const comboBonus = combo * 50;

    setPerfectCakes(prev => prev + 1);
    setCombo(prev => prev + 1);
    if (combo + 1 > highestCombo) setHighestCombo(combo + 1);
    setScore(prev => prev + 500 + bonus + timeBonus + comboBonus);
    setCompletedOrders(prev => prev + 1);
    setShowResult(true);
    setResultMessage('✨ PERFECT CAKE! ✨');
    setResultType('perfect');
    setParticles(generateParticles(30));

    // Achievement check
    if (perfectCakes + 1 === 1) unlockAchievement('First Cake! 🍰');
    if (perfectCakes + 1 === 5) unlockAchievement('Perfect Baker! ⭐');
    if (combo + 1 === 5) unlockAchievement('Combo King! 🔥');

    // Check level complete
    if (completedOrders + 1 >= config.ordersRequired) {
      setTimeout(() => {
        setShowResult(false);
        handleLevelComplete();
      }, 2000);
    } else {
      setTimeout(() => {
        setShowResult(false);
        generateNewOrder(levelIndex);
      }, 2000);
    }
  };

  // --- Incorrect cake handler ---
  const handleIncorrectCake = (errors) => {
    setMistakes(prev => prev + 1);
    setCombo(0);
    setCompletedOrders(prev => prev + 1);
    setShowResult(true);
    setResultMessage('❌ Cake Not Quite Right');
    setResultType('incorrect');

    const errorText = errors.slice(0, 3).join(', ');
    setResultMessage(prev => prev + `\n${errorText}`);

    if (mistakes + 1 >= maxMistakes) {
      // Game Over
      setTimeout(() => {
        setShowResult(false);
        setGameState('gameOver');
        saveGameData();
      }, 2500);
    } else {
      setTimeout(() => {
        setShowResult(false);
        generateNewOrder(levelIndex);
      }, 2000);
    }
  };

  // --- Level complete ---
  const handleLevelComplete = () => {
    const config = LEVELS[levelIndex];
    const efficiency = Math.round((perfectCakes / (perfectCakes + mistakes)) * 100);
    setEfficiency(efficiency);
    setGameState('levelComplete');
    setConfettiActive(true);
    saveGameData();

    if (levelIndex >= LEVELS.length - 1) {
      // Final level complete - VICTORY!
      setTimeout(() => {
        setConfettiActive(false);
        setGameState('victory');
      }, 3000);
    }
  };

  // --- Game Over ---
  const handleGameOver = () => {
    setGameState('gameOver');
    saveGameData();
  };

  // --- Save game data ---
  const saveGameData = () => {
    const data = {
      levelIndex,
      score,
      bestScore: Math.max(bestScore, score),
      highestCombo,
      perfectCakes,
      totalOrders: completedOrders
    };
    localStorage.setItem('cozyCakeFactory_data', JSON.stringify(data));
    // Sync with backend
    if (user) {
      updateScore(user.name, 'cozyCakeFactory', {
        bestScore: Math.max(bestScore, score),
        highestLevel: Math.max(levelIndex + 1, 0),
        totalPerfectCakes: perfectCakes,
        bestEfficiency: Math.max(0, efficiency),
        highestCombo
      }).catch(console.error);
    }
  };

  // --- Load saved game ---
  const loadSavedGame = () => {
    const saved = localStorage.getItem('cozyCakeFactory_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setLevelIndex(data.levelIndex || 0);
        setScore(data.score || 0);
        setBestScore(data.bestScore || 0);
        setHighestCombo(data.highestCombo || 0);
        setPerfectCakes(data.perfectCakes || 0);
        setCompletedOrders(data.totalOrders || 0);
        return true;
      } catch (e) {}
    }
    return false;
  };

  // --- Achievements ---
  const unlockAchievement = (message) => {
    setShowAchievement(message);
    setTimeout(() => setShowAchievement(null), 3000);
  };

  // --- Particles ---
  const generateParticles = (count) => {
    const colors = ['#ff8a9a', '#ffd93d', '#6bcbff', '#a66cff', '#ffd700', '#ff6b6b'];
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vy: 1 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 2,
        life: 1 + Math.random() * 0.5
      });
    }
    return particles;
  };

  // --- Render Cake Visual ---
  const renderCakeVisual = (shape, flavor, layers, frosting, decoration, sprinkles, size = 100) => {
    const baseColor = FLAVOR_COLORS[flavor] || '#f5e6d3';
    const frostColor = FROSTING_COLORS[frosting] || '#f5e6d3';
    const decIcon = DECORATION_ICONS[decoration] || '';
    const sprinkleColor = SPRINKLE_COLORS[sprinkles] || '';

    return (
      <div className={`cake-visual cake-${shape}`} style={{ width: size, height: size }}>
        <div className="cake-base" style={{ background: baseColor, borderRadius: shape === 'round' ? '50%' : '8px' }} />
        {layers.map((layer, idx) => (
          <div key={idx} className="cake-layer" style={{ 
            background: FLAVOR_COLORS[layer] || '#f5e6d3',
            width: '85%',
            height: `${100 / (layers.length + 1)}%`,
            bottom: `${(idx + 1) * (100 / (layers.length + 1))}%`,
            borderRadius: shape === 'round' ? '50%' : '6px'
          }} />
        ))}
        <div className="cake-frosting" style={{ background: frostColor, borderRadius: shape === 'round' ? '50%' : '6px' }} />
        {decIcon && (
          <div className="cake-decoration" style={{ fontSize: size * 0.2 }}>
            {decIcon}
          </div>
        )}
        {sprinkles !== 'none' && sprinkleColor !== '' && (
          <div className="cake-sprinkles" style={{ background: sprinkleColor }} />
        )}
      </div>
    );
  };

  // --- Render start screen ---
  if (gameState === 'start') {
    return (
      <>
        <Helmet>
          <title>Cozy Cake Factory – Free Cake Making Game</title>
          <meta name="description" content="Bake cakes, complete custom orders, decorate delicious creations in Cozy Cake Factory!" />
        </Helmet>
        <div className="cozy-factory-start">
          <div className="start-content">
            <h1>🧁 Cozy Cake Factory</h1>
            <p>Welcome to the sweetest factory in town!</p>
            <div className="start-options">
              <button onClick={() => { setupLevel(0); }} className="btn-bake">🍰 Start Baking</button>
              {loadSavedGame() && (
                <button onClick={() => { setupLevel(levelIndex); }} className="btn-bake-secondary">↩ Continue Bakery</button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // --- Render main game ---
  return (
    <>
      <Helmet>
        <title>Cozy Cake Factory – Cake Making Game</title>
        <meta name="description" content="Bake cakes, complete custom orders, decorate delicious creations in Cozy Cake Factory!" />
      </Helmet>
      <div className="cozy-factory-game">
        {/* ===== HEADER ===== */}
        <div className="factory-header">
          <h1>🧁 Cozy Cake Factory</h1>
          <div className="header-stats">
            <div className="stat"><span>Score</span><strong>{score}</strong></div>
            <div className="stat"><span>Orders</span><strong>{completedOrders}/{requiredOrders}</strong></div>
            <div className="stat"><span>Mistakes</span><strong>{mistakes}/{maxMistakes}</strong></div>
            <div className="stat"><span>⭐ Perfect</span><strong>{perfectCakes}</strong></div>
            <div className="stat"><span>🔥 Combo</span><strong>{combo}x</strong></div>
            <div className="stat"><span>⏱️</span><strong className={timeWarning ? 'timer-warning' : ''}>{timer}s</strong></div>
          </div>
        </div>

        {/* ===== MAIN LAYOUT ===== */}
        <div className="factory-main">
          {/* ===== LEFT: Order ===== */}
          <div className="factory-left">
            <div className="order-panel">
              <h3>📋 Current Order</h3>
              {currentOrder && (
                <div className="order-details">
                  <div className="order-preview">
                    {renderCakeVisual(
                      currentOrder.shape, 
                      currentOrder.flavor, 
                      currentOrder.layerColors, 
                      currentOrder.frosting, 
                      currentOrder.decoration, 
                      currentOrder.sprinkles,
                      120
                    )}
                  </div>
                  <div className="order-specs">
                    <div><span>Shape:</span> {SHAPE_ICONS[currentOrder.shape]} {currentOrder.shape}</div>
                    <div><span>Flavor:</span> {currentOrder.flavor}</div>
                    <div><span>Layers:</span> {currentOrder.layers}</div>
                    <div><span>Layer Colors:</span> {currentOrder.layerColors.join(' → ')}</div>
                    <div><span>Frosting:</span> {currentOrder.frosting}</div>
                    <div><span>Decoration:</span> {currentOrder.decoration || 'None'}</div>
                    <div><span>Sprinkles:</span> {currentOrder.sprinkles || 'None'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== CENTER: Factory Conveyor ===== */}
          <div className="factory-center">
            <div className="conveyor-belt">
              <div className="conveyor-stations">
                <div className={`station ${activeStation === 'pan' ? 'active' : ''}`}>
                  <span>🍳</span>
                  <small>Pan</small>
                </div>
                <div className={`station ${activeStation === 'batter' ? 'active' : ''}`}>
                  <span>🥣</span>
                  <small>Batter</small>
                </div>
                <div className={`station ${activeStation === 'layers' ? 'active' : ''}`}>
                  <span>📚</span>
                  <small>Layers</small>
                </div>
                <div className={`station ${activeStation === 'frosting' ? 'active' : ''}`}>
                  <span>🧁</span>
                  <small>Frosting</small>
                </div>
                <div className={`station ${activeStation === 'decoration' ? 'active' : ''}`}>
                  <span>✨</span>
                  <small>Decorate</small>
                </div>
                <div className={`station ${activeStation === 'sprinkles' ? 'active' : ''}`}>
                  <span>🌈</span>
                  <small>Sprinkles</small>
                </div>
                <div className={`station ${activeStation === 'packaging' ? 'active' : ''}`}>
                  <span>📦</span>
                  <small>Package</small>
                </div>
              </div>
              <div className="cake-display">
                <div className="cake-building">
                  {renderCakeVisual(
                    selectedShape || 'round',
                    selectedFlavor || 'vanilla',
                    selectedLayers.length > 0 ? selectedLayers : ['vanilla'],
                    selectedFrosting || 'vanilla',
                    selectedDecoration || 'none',
                    selectedSprinkles || 'none',
                    150
                  )}
                </div>
                <div className="station-controls">
                  {activeStation === 'pan' && (
                    <div className="controls-grid">
                      {LEVELS[levelIndex].shapes.map(shape => (
                        <button key={shape} onClick={() => setSelectedShape(shape)} className={selectedShape === shape ? 'active' : ''}>
                          {SHAPE_ICONS[shape]} {shape}
                        </button>
                      ))}
                      <button onClick={nextStation} className="btn-next">Next →</button>
                    </div>
                  )}
                  {activeStation === 'batter' && (
                    <div className="controls-grid">
                      {LEVELS[levelIndex].flavors.map(flavor => (
                        <button key={flavor} onClick={() => setSelectedFlavor(flavor)} className={selectedFlavor === flavor ? 'active' : ''}>
                          <span style={{ color: FLAVOR_COLORS[flavor] }}>●</span> {flavor}
                        </button>
                      ))}
                      <button onClick={nextStation} className="btn-next">Next →</button>
                    </div>
                  )}
                  {activeStation === 'layers' && (
                    <div className="controls-grid">
                      <div className="layer-controls">
                        <div className="layer-display">
                          {selectedLayers.map((layer, i) => (
                            <span key={i} className="layer-pill" style={{ background: FLAVOR_COLORS[layer] || '#f5e6d3' }}>
                              {layer}
                            </span>
                          ))}
                          {Array.from({ length: currentOrder?.layers - selectedLayers.length || 0 }).map((_, i) => (
                            <span key={i} className="layer-pill empty">⬜</span>
                          ))}
                        </div>
                        <div className="layer-buttons">
                          {LEVELS[levelIndex].flavors.map(flavor => (
                            <button key={flavor} onClick={() => addLayer(flavor)} className="layer-add">
                              <span style={{ color: FLAVOR_COLORS[flavor] }}>●</span> {flavor}
                            </button>
                          ))}
                          {selectedLayers.length > 0 && (
                            <button onClick={removeLastLayer} className="btn-remove">↩ Remove</button>
                          )}
                          {selectedLayers.length === currentOrder?.layers && (
                            <button onClick={nextStation} className="btn-next">Next →</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {activeStation === 'frosting' && (
                    <div className="controls-grid">
                      {LEVELS[levelIndex].frostingOptions.map(frost => (
                        <button key={frost} onClick={() => setSelectedFrosting(frost)} className={selectedFrosting === frost ? 'active' : ''}>
                          <span style={{ color: FROSTING_COLORS[frost] }}>●</span> {frost}
                        </button>
                      ))}
                      <button onClick={nextStation} className="btn-next">Next →</button>
                    </div>
                  )}
                  {activeStation === 'decoration' && (
                    <div className="controls-grid">
                      {LEVELS[levelIndex].decorations.map(dec => (
                        <button key={dec} onClick={() => setSelectedDecoration(dec)} className={selectedDecoration === dec ? 'active' : ''}>
                          {DECORATION_ICONS[dec] || '🚫'} {dec === 'none' ? 'None' : dec}
                        </button>
                      ))}
                      <button onClick={nextStation} className="btn-next">Next →</button>
                    </div>
                  )}
                  {activeStation === 'sprinkles' && (
                    <div className="controls-grid">
                      {LEVELS[levelIndex].sprinkles.map(spr => (
                        <button key={spr} onClick={() => setSelectedSprinkles(spr)} className={selectedSprinkles === spr ? 'active' : ''}>
                          {spr === 'none' ? '🚫 None' : <span style={{ color: SPRINKLE_COLORS[spr] || '#fff' }}>✦</span>} {spr}
                        </button>
                      ))}
                      <button onClick={nextStation} className="btn-next">Next →</button>
                    </div>
                  )}
                  {activeStation === 'packaging' && (
                    <div className="controls-grid">
                      <button onClick={() => validateCake(true)} className="btn-deliver">📦 Deliver Cake!</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== RIGHT: Your Cake Preview ===== */}
          <div className="factory-right">
            <div className="preview-panel">
              <h3>🎂 Your Cake</h3>
              <div className="preview-cake">
                {renderCakeVisual(
                  selectedShape || 'round',
                  selectedFlavor || 'vanilla',
                  selectedLayers.length > 0 ? selectedLayers : ['vanilla'],
                  selectedFrosting || 'vanilla',
                  selectedDecoration || 'none',
                  selectedSprinkles || 'none',
                  140
                )}
              </div>
              <div className="preview-details">
                <div><span>Shape:</span> {selectedShape}</div>
                <div><span>Flavor:</span> {selectedFlavor}</div>
                <div><span>Layers:</span> {selectedLayers.length}/{currentOrder?.layers || 0}</div>
                <div><span>Frosting:</span> {selectedFrosting}</div>
                <div><span>Decoration:</span> {selectedDecoration}</div>
                <div><span>Sprinkles:</span> {selectedSprinkles}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Result Modal ===== */}
        {showResult && (
          <div className="result-overlay">
            <div className={`result-modal ${resultType}`}>
              <div className="result-icon">{resultType === 'perfect' ? '✨' : '💔'}</div>
              <h2>{resultMessage.split('\n')[0]}</h2>
              {resultMessage.split('\n').slice(1).map((line, i) => (
                <p key={i} className="result-detail">{line}</p>
              ))}
            </div>
          </div>
        )}

        {/* ===== Achievement Popup ===== */}
        {showAchievement && (
          <div className="achievement-toast">
            <span>🏆</span> {showAchievement}
          </div>
        )}

        {/* ===== Level Complete Modal ===== */}
        {gameState === 'levelComplete' && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>🎉 Level Complete!</h2>
              <div className="stars">
                {efficiency >= 90 ? '⭐⭐⭐' : efficiency >= 70 ? '⭐⭐' : '⭐'}
              </div>
              <div className="stats">
                <div><span>Score</span><strong>{score}</strong></div>
                <div><span>Perfect Cakes</span><strong>{perfectCakes}</strong></div>
                <div><span>Efficiency</span><strong>{efficiency}%</strong></div>
                <div><span>Best Combo</span><strong>{highestCombo}x</strong></div>
              </div>
              {levelIndex < LEVELS.length - 1 ? (
                <button onClick={() => { setLevelIndex(levelIndex + 1); setupLevel(levelIndex + 1); }} className="btn-bake">➡️ Next Level</button>
              ) : (
                <button onClick={() => { setGameState('victory'); }} className="btn-bake">👑 View Victory</button>
              )}
              <button onClick={() => { setGameState('start'); }} className="btn-bake-secondary">🏠 Back to Bakery</button>
            </div>
          </div>
        )}

        {/* ===== Game Over Modal ===== */}
        {gameState === 'gameOver' && (
          <div className="modal-overlay">
            <div className="modal-content gameover">
              <h2>🍰 Bakery Closed</h2>
              <div className="stats">
                <div><span>Final Score</span><strong>{score}</strong></div>
                <div><span>Orders Completed</span><strong>{completedOrders}</strong></div>
                <div><span>Perfect Cakes</span><strong>{perfectCakes}</strong></div>
                <div><span>Efficiency</span><strong>{efficiency}%</strong></div>
                <div><span>Best Combo</span><strong>{highestCombo}x</strong></div>
              </div>
              <p className="ending-line">"Every great baker has a few messy cakes."</p>
              <button onClick={() => { setLevelIndex(0); setupLevel(0); }} className="btn-bake">🔄 Try Again</button>
              <button onClick={() => { setGameState('start'); }} className="btn-bake-secondary">🏠 Back to Bakery</button>
            </div>
          </div>
        )}

        {/* ===== Victory Modal ===== */}
        {gameState === 'victory' && (
          <div className="modal-overlay victory">
            <div className="modal-content">
              <h2>👑 Master Baker!</h2>
              <p>YOU DID IT!</p>
              <div className="stats">
                <div><span>Total Cakes</span><strong>{completedOrders}</strong></div>
                <div><span>Perfect Cakes</span><strong>{perfectCakes}</strong></div>
                <div><span>Efficiency</span><strong>{efficiency}%</strong></div>
                <div><span>Highest Combo</span><strong>{highestCombo}x</strong></div>
                <div><span>Total Score</span><strong>{score}</strong></div>
              </div>
              <p className="ending-line">"From the first little cake to the final masterpiece — you became a Master Baker."</p>
              <button onClick={() => { setLevelIndex(0); setupLevel(0); }} className="btn-bake">🔄 Play Again</button>
              <button onClick={() => { setGameState('start'); }} className="btn-bake-secondary">🏠 Back to Bakery</button>
            </div>
          </div>
        )}

        {/* ===== Confetti Canvas ===== */}
        {confettiActive && (
          <canvas id="confetti-canvas" style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 999 }} />
        )}
      </div>
    </>
  );
}