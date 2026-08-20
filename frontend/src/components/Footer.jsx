export default function Footer() {
  return (
    <footer style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      textAlign: 'center', padding: '12px',
      color: 'rgba(255,255,255,0.2)', fontSize: '12px',
      background: 'rgba(10,14,26,0.6)', backdropFilter: 'blur(6px)'
    }}>
      © 2026 GameArcade – All games are skill-based.
    </footer>
  );
}