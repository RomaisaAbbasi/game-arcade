import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { loginUser } from './utils/api';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SpaceJump from './pages/SpaceJump';
import MemoryFlip from './pages/MemoryFlip';
import TwentyFortyEight from './pages/2048Plus';
import CozyCakeFactory from './pages/CozyCakeFactory';
import WordHunt from './pages/WordHunt';
import BubbleBlast from './pages/BubbleBlast';  // new game

function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('gameUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem('gameUser');
      }
    }
  }, []);

  const handleLogin = async (name) => {
    try {
      const res = await loginUser(name);
      const userData = res.data;
      setUser(userData);
      localStorage.setItem('gameUser', JSON.stringify(userData));
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('gameUser');
    navigate('/');
  };

  // ---- Login Screen ----
  if (!user) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '40px', borderRadius: '24px', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h1 style={{ color: '#fff', fontSize: '36px', marginBottom: '8px' }}>🎮 GameArcade</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '24px', fontSize: '14px' }}>Enter your name to start playing</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const name = e.target.name.value.trim();
            if (name) handleLogin(name);
          }}>
            <input 
              name="name" 
              type="text" 
              placeholder="Your name" 
              autoFocus 
              style={{ 
                width: '100%', 
                padding: '14px 18px', 
                borderRadius: '14px', 
                border: '1px solid rgba(255,255,255,0.08)', 
                background: 'rgba(255,255,255,0.04)', 
                color: '#fff', 
                fontSize: '16px', 
                marginBottom: '16px', 
                outline: 'none',
                transition: 'border-color 0.3s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#4a7aff'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            <button 
              type="submit" 
              style={{ 
                width: '100%', 
                padding: '16px', 
                borderRadius: '14px', 
                border: 'none', 
                background: 'linear-gradient(135deg, #4a7aff, #7a4aff)', 
                color: '#fff', 
                fontSize: '20px', 
                fontWeight: 'bold', 
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 8px 30px rgba(74, 122, 255, 0.25)'
              }}
              onMouseEnter={(e) => { e.target.style.transform = 'scale(1.02)'; e.target.style.boxShadow = '0 10px 40px rgba(74, 122, 255, 0.35)'; }}
              onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = '0 8px 30px rgba(74, 122, 255, 0.25)'; }}
            >
              🚀 Play
            </button>
          </form>
          <div style={{ marginTop: '16px', color: 'rgba(255,255,255,0.15)', fontSize: '12px' }}>
            6 games available · Free to play
          </div>
        </div>
      </div>
    );
  }

  // ---- Main App ----
  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />
      <div style={{ 
        paddingTop: '70px', 
        height: 'calc(100vh - 70px)', 
        overflowY: 'auto',
        scrollBehavior: 'smooth'
      }}>
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/games/space-jump" element={<SpaceJump user={user} />} />
          <Route path="/games/memory-flip" element={<MemoryFlip user={user} />} />
          <Route path="/games/2048-plus" element={<TwentyFortyEight user={user} />} />
          <Route path="/games/cozy-cake-factory" element={<CozyCakeFactory user={user} />} />
          <Route path="/games/word-hunt" element={<WordHunt user={user} />} />
          <Route path="/games/bubble-blast" element={<BubbleBlast user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <Footer />
    </>
  );
}

export default App;