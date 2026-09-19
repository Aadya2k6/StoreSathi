import { NavLink } from 'react-router-dom';
import './Dock.css';

const Dock = () => {
  return (
    <div className="dock-container">
      <nav className="dock glass-panel">
        <NavLink to="/" className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}>
          <div className="dock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
          <span className="dock-label">Overview</span>
        </NavLink>

        <NavLink to="/opportunities" className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}>
          <div className="dock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <span className="dock-label">Opportunities</span>
        </NavLink>

        <NavLink to="/campaigns" className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}>
          <div className="dock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
          </div>
          <span className="dock-label">Campaigns</span>
        </NavLink>

        <NavLink to="/actions" className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}>
          <div className="dock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <span className="dock-label">Actions</span>
        </NavLink>

        <NavLink to="/copilot" className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}>
          <div className="dock-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <span className="dock-label">Copilot</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Dock;
