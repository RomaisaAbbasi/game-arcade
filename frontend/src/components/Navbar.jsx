import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 32px',
      background: 'rgba(10,14,26,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)'
    }}>
      <Link to="/" style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff', textShadow: '0 0 20px rgba(74,122,255,0.3)' }}>
        🎮 GameArcade
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {user && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px' }}>👤 {user.name}</span>}
        <button onClick={handleLogout} style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '14px',
          padding: '8px 16px',
          borderRadius: '30px',
          transition: '0.3s'
        }} onMouseEnter={(e) => { e.target.style.background = 'rgba(255,70,70,0.15)'; e.target.style.color = '#ff6b6b'; }} onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = 'rgba(255,255,255,0.6)'; }}>
          Logout
        </button>
      </div>
    </nav>
  );
}