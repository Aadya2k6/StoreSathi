import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Overview from './pages/Overview';
import Opportunities from './pages/Opportunities';
import ActionHistory from './pages/ActionHistory';
import Campaigns from './pages/Campaigns';
import CopilotPage from './pages/CopilotPage';
import Dock from './components/Dock';

import Login from './pages/Login';

function App() {
  const [storeId, setStoreId] = useState(localStorage.getItem('portal_storeId') || 'store_1');
  const [storeName, setStoreName] = useState(localStorage.getItem('portal_storeName') || 'Vogue Threads');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('portal_token'));

  const handleLogin = (user) => {
    setStoreId(user.store_id);
    setStoreName(user.store_name || user.email);
    localStorage.setItem('portal_storeId', user.store_id);
    localStorage.setItem('portal_storeName', user.store_name || user.email);
    localStorage.setItem('portal_token', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_storeId');
    localStorage.removeItem('portal_storeName');
    setIsAuthenticated(false);
  };

  const handleStoreChange = (e) => {
    const newStoreId = e.target.value;
    setStoreId(newStoreId);
    localStorage.setItem('portal_storeId', newStoreId);
    window.dispatchEvent(new Event('storeIdChanged')); // Notify other components
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

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
          <div className="store-selector" style={{ marginLeft: 'auto', marginRight: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '6px 12px', borderRadius: '8px', fontWeight: 600 }}>
              {storeName}
            </div>
          </div>
          <div className="user-profile">
            <div 
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--status-error-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="Logout"
              onClick={handleLogout}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </div>
          </div>
        </header>

        <main className="main-content animate-fade-in">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/actions" element={<ActionHistory />} />
            <Route path="/copilot" element={<CopilotPage />} />
          </Routes>
        </main>

        <Dock />
        
      </div>
    </Router>
  );
}

export default App;
