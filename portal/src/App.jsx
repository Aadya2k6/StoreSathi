import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Overview from './pages/Overview';
import Opportunities from './pages/Opportunities';
import History from './pages/History';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <div className="app-container">
        <aside className="sidebar glass-card">
          <h2 style={{ color: 'var(--primary-deep)', marginBottom: '2rem' }}>StoreSathi</h2>
          <nav>
            <NavLink to="/">Overview</NavLink>
            <NavLink to="/opportunities">Opportunities</NavLink>
            <NavLink to="/history">History</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
