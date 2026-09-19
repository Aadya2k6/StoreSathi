import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Overview.css';

function Overview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOpportunities: 0,
    activeAlerts: 0,
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOverviewData = async () => {
    setLoading(true);
    const storeId = localStorage.getItem('portal_storeId') || 'store_1';
    
    try {
      // 1. Fetch KPI metrics
      const statsRes = await fetch(`/api/intelligence/stats?store_id=${encodeURIComponent(storeId)}`);
      if (statsRes.ok) {
        const { data } = await statsRes.json();
        setStats({
          totalProducts: data.totalProducts || 0,
          totalOpportunities: data.totalOpportunities || 0,
          activeAlerts: data.activeAlerts || 0
        });
      }

      // 2. Fetch ingested live products
      const prodRes = await fetch(`/api/catalogue?store_id=${encodeURIComponent(storeId)}`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(Array.isArray(prodData) ? prodData : []);
      }
    } catch (err) {
      console.error("Failed to fetch overview data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  return (
    <div className="overview-container animate-fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Command Center</h1>
          <p className="subtitle">Real-time market intelligence overview for your store</p>
        </div>
        <button 
          onClick={fetchOverviewData} 
          style={{ 
            background: 'rgba(124, 58, 237, 0.15)', 
            border: '1px solid rgba(124, 58, 237, 0.4)', 
            color: '#a78bfa', 
            padding: '8px 16px', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 600,
            fontSize: '0.85rem'
          }}
        >
          🔄 Refresh Data
        </button>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card glass-panel">
          <div className="kpi-icon violet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </div>
          <div className="kpi-content">
            <h3>Total Inventory</h3>
            <div className="kpi-value">{loading ? '...' : (products.length || stats.totalProducts)}</div>
            <span className="trend positive">Live synced products</span>
          </div>
        </div>

        <div 
          className="kpi-card glass-panel" 
          onClick={() => navigate('/opportunities')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to view all opportunities"
        >
          <div className="kpi-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div className="kpi-content">
            <h3>Opportunities</h3>
            <div className="kpi-value">{loading ? '...' : stats.totalOpportunities}</div>
            <span className="trend" style={{ color: '#60a5fa' }}>View feed & launch →</span>
          </div>
        </div>

        <div 
          className="kpi-card glass-panel highlight"
          onClick={() => navigate('/actions')}
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to view action history"
        >
          <div className="kpi-icon gradient">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div className="kpi-content">
            <h3>Completed Actions</h3>
            <div className="kpi-value">{loading ? '...' : stats.activeAlerts}</div>
            <span className="trend alert">Approved history →</span>
          </div>
        </div>
      </div>

      {/* Live Store Inventory Table */}
      {products.length > 0 ? (
        <div className="glass-panel" style={{ marginTop: '24px', padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Live Ingested Inventory</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Products ingested directly from your storefront via the StoreSathi Chrome Extension
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '4px 12px', borderRadius: '99px', fontWeight: 600 }}>
              ✓ {products.length} Products Synced
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px' }}>Product</th>
                  <th style={{ padding: '12px 14px' }}>Category</th>
                  <th style={{ padding: '12px 14px' }}>In Stock</th>
                  <th style={{ padding: '12px 14px' }}>Price</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '14px', fontWeight: 600, color: '#f3f4f6' }}>{p.name}</td>
                    <td style={{ padding: '14px', color: 'var(--text-muted)' }}>{p.category}</td>
                    <td style={{ padding: '14px', color: p.stock_quantity < 10 ? '#f87171' : '#34d399', fontWeight: 700 }}>
                      {p.stock_quantity} units
                    </td>
                    <td style={{ padding: '14px', fontWeight: 700, color: '#f3f4f6' }}>₹{p.price}</td>
                    <td style={{ padding: '14px' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '3px 10px', 
                        borderRadius: '99px', 
                        fontWeight: 600,
                        background: p.stock_quantity < 10 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', 
                        color: p.stock_quantity < 10 ? '#fca5a5' : '#6ee7b7' 
                      }}>
                        {p.stock_quantity < 10 ? 'Low Stock' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ marginTop: '24px', padding: '32px', borderRadius: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📦</div>
          <h3 style={{ marginBottom: '8px', fontSize: '1.2rem', fontWeight: 600 }}>Your Store Catalog is Empty</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 20px auto', lineHeight: '1.6', fontSize: '0.9rem' }}>
            Open your storefront website (or <code>demo.html</code>) in Chrome with the StoreSathi plugin open. Click <strong>"📥 Approve & Feed to Portal"</strong> to ingest your live products directly into this dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

export default Overview;
