import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Overview from './pages/Overview';
import Opportunities from './pages/Opportunities';
import History from './pages/History';
import Settings from './pages/Settings';
import Campaigns from './pages/Campaigns';
import Dock from './components/Dock';

function App() {
  return (
    <Router>
      <div className="app-layout">
        
        <header className="topbar">
          <div className="brand-logo animate-fade-in">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            <span className="text-gradient">StoreSathi</span>
          </div>
          <div className="user-profile">
            {/* Placeholder for future user profile or connection status */}
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
          </div>
        </header>

        <main className="main-content animate-fade-in">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <Dock />
        
      </div>
    </Router>
  );
}

export default App;
