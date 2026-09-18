import { useState, useEffect } from 'react';
import './Overview.css';

function Overview() {
  const [stats, setStats] = useState({
    snapshots: 0,
    opportunities: 0,
    activeAlerts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [snapRes, oppRes] = await Promise.all([
          fetch('/api/snapshots').then(r => r.json()),
          fetch('/api/opportunities').then(r => r.json())
        ]);
        
        const draftedCount = (oppRes.data || []).filter(o => o.status === 'drafted' || o.status === 'sent_for_approval').length;

        setStats({
          snapshots: snapRes.count || 0,
          opportunities: oppRes.count || 0,
          activeAlerts: draftedCount
        });
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="overview-container animate-fade-in">
      <header className="page-header">
        <h1>Command Center</h1>
        <p className="subtitle">Real-time market intelligence overview</p>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card glass-panel">
          <div className="kpi-icon violet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <div className="kpi-content">
            <h3>Total Snapshots</h3>
            <div className="kpi-value">{loading ? '...' : stats.snapshots}</div>
            <span className="trend positive">↑ Products tracked</span>
          </div>
        </div>

        <div className="kpi-card glass-panel">
          <div className="kpi-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div className="kpi-content">
            <h3>Opportunities</h3>
            <div className="kpi-value">{loading ? '...' : stats.opportunities}</div>
            <span className="trend">Detected across web</span>
          </div>
        </div>

        <div className="kpi-card glass-panel highlight">
          <div className="kpi-icon gradient">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div className="kpi-content">
            <h3>Active Alerts</h3>
            <div className="kpi-value">{loading ? '...' : stats.activeAlerts}</div>
            <span className="trend alert">Awaiting your approval</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-panel glass-panel">
          <h3>Market Activity</h3>
          <div className="placeholder-chart">
            <div className="bar" style={{height: '30%'}}></div>
            <div className="bar" style={{height: '50%'}}></div>
            <div className="bar" style={{height: '80%'}}></div>
            <div className="bar" style={{height: '40%'}}></div>
            <div className="bar" style={{height: '100%', background: 'var(--brand-primary)'}}></div>
            <div className="bar" style={{height: '60%'}}></div>
            <div className="bar" style={{height: '75%'}}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Overview;
