import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

export default function HomePage({ user }) {
  // Safely extract scores for all remaining games
  const spaceJumpScore = user?.scores?.spaceJump?.highScore || 0;
  const memoryFlipScore = user?.scores?.memoryFlip?.bestScore || 0;
  const twothousandFortyEightScore = user?.scores?.twothousandFortyEight?.bestScore || 0;
  const cozyCakeFactoryScore = user?.scores?.cozyCakeFactory?.bestScore || 0;
  const wordHuntScore = user?.scores?.wordHunt?.bestScore || 0;
  const bubbleBlastScore = user?.scores?.bubbleBlast?.bestScore || 0;

  return (
    <>
      <SEO 
        title="GameArcade – Play Space Jump, Memory Flip, 2048 Plus, Cozy Cake Factory, Word Hunt & Bubble Blast" 
        description="Play free online games: Space Jump, Memory Flip, 2048 Plus, Cozy Cake Factory, Word Hunt and Bubble Blast. Challenge your memory, reflexes, puzzle, baking, word and bubble shooting skills!" 
        canonical="/" 
      />
      <div style={{ 
        padding: '40px 20px', 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        textAlign: 'center' 
      }}>
        <h1 style={{ 
          fontSize: '56px', 
          marginBottom: '20px', 
          background: 'linear-gradient(135deg, #8ab4ff, #ff8a9a)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent' 
        }}>
          🎮 Game Arcade
        </h1>
        <p style={{ 
          color: 'rgba(255,255,255,0.6)', 
          fontSize: '18px', 
          maxWidth: '600px', 
          marginBottom: '40px' 
        }}>
          Challenge your memory, reflexes, puzzle, baking, word and bubble shooting skills with our collection of exciting games.
        </p>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '30px', 
          justifyContent: 'center',
          maxWidth: '900px',
          width: '100%'
        }}>
          <GameCard 
            to="/games/space-jump" 
            icon="🚀" 
            title="Space Jump" 
            desc="Hold SPACE to rise, avoid obstacles!" 
            score={spaceJumpScore} 
          />
          <GameCard 
            to="/games/memory-flip" 
            icon="🧠" 
            title="Memory Flip" 
            desc="Match pairs, improve your score!" 
            score={memoryFlipScore} 
          />
          <GameCard 
            to="/games/2048-plus" 
            icon="🔢" 
            title="2048 Plus" 
            desc="Merge numbers, reach 2048!" 
            score={twothousandFortyEightScore} 
          />
          <GameCard 
            to="/games/cozy-cake-factory" 
            icon="🧁" 
            title="Cozy Cake Factory" 
            desc="Bake cakes, complete orders!" 
            score={cozyCakeFactoryScore} 
          />
          <GameCard 
            to="/games/word-hunt" 
            icon="🔍" 
            title="Word Hunt" 
            desc="Find hidden words!" 
            score={wordHuntScore} 
          />
          <GameCard 
  to="/games/bubble-blast" 
  icon="🫧" 
  title="Bubble Blast" 
  desc="Aim, match, blast bubbles!" 
  score={user?.scores?.bubbleBlast?.bestScore || 0} 
/>
        </div>
      </div>
    </>
  );
}

function GameCard({ to, icon, title, desc, score }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="game-card" style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '24px',
        padding: '24px 16px',
        border: '1px solid rgba(255,255,255,0.06)',
        transition: '0.3s',
        textAlign: 'center',
        cursor: 'pointer',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: '48px' }}>{icon}</div>
        <h3 style={{ color: '#fff', margin: '10px 0 6px', fontSize: '18px' }}>{title}</h3>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '8px' }}>{desc}</p>
        <div style={{ marginTop: 'auto', color: '#ffd700', fontSize: '14px' }}>
          🏆 High: {score.toLocaleString()}
        </div>
      </div>
    </Link>
  );
}