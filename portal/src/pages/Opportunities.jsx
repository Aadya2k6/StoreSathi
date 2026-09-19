import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Opportunities.css';

function Opportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [approvingId, setApprovingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const navigate = useNavigate();

  const storeId = localStorage.getItem('portal_storeId') || 'store_1';

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/intelligence/recommendations?store_id=${encodeURIComponent(storeId)}`);
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [storeId]);

  const handleApprove = async (id, title) => {
    setApprovingId(id);
    try {
      const res = await fetch(`/api/intelligence/recommendations/${id}/approve?store_id=${encodeURIComponent(storeId)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        // Mark as approved locally
        setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: 'approved' } : o));
        setFeedback({
          text: data.message || `Action approved: "${title}"`,
          campaignCreated: data.campaignCreated
        });
        setTimeout(() => setFeedback(null), 5000);
      } else {
        alert(data.error || 'Failed to approve action');
      }
    } catch (err) {
      alert('Network error while approving action');
    } finally {
      setApprovingId(null);
    }
  };

  const getTypeIcon = (type, title = '') => {
    if (type === 'growth_opportunity' || title.toLowerCase().includes('growth')) return '🚀';
    if (type === 'weather_restock' || title.toLowerCase().includes('weather')) return '☁️';
    if (type === 'trend_promotion' || title.toLowerCase().includes('spike') || title.toLowerCase().includes('trend')) return '🔥';
    if (type === 'discount' || title.toLowerCase().includes('clearance') || title.toLowerCase().includes('price')) return '🏷️';
    if (type === 'restock' || title.toLowerCase().includes('stock')) return '📦';
    return '✨';
  };

  const getPriorityInfo = (opp) => {
    let priority = opp.priority || 'Medium';
    if (opp.evidence_data) {
      try {
        const ev = JSON.parse(opp.evidence_data);
        if (ev.priority) priority = ev.priority;
      } catch (_) {}
    }
    const p = priority.toLowerCase();
    if (p === 'urgent' || p === 'critical') return { label: 'Urgent', cls: 'badge-error' };
    if (p === 'high') return { label: 'High', cls: 'badge-warning' };
    return { label: 'Medium', cls: 'badge-info' };
  };

  const filteredOpps = opportunities.filter(opp => {
    if (filter === 'all') return true;
    if (filter === 'growth') {
      return opp.type === 'growth_opportunity' || 
             opp.type === 'trend_promotion' || 
             (opp.title && opp.title.toLowerCase().includes('growth')) ||
             (opp.description && opp.description.toLowerCase().includes('whatsapp'));
    }
    if (filter === 'restock') {
      return opp.type === 'restock' || 
             opp.type === 'weather_restock' || 
             (opp.title && opp.title.toLowerCase().includes('stock'));
    }
    if (filter === 'discount') {
      return opp.type === 'discount' || 
             (opp.title && opp.title.toLowerCase().includes('clearance')) ||
             (opp.description && opp.description.toLowerCase().includes('discount'));
    }
    return true;
  });

  return (
    <div className="opp-container animate-fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Growth & Inventory Opportunities</h1>
          <p className="subtitle">Real-time actionable alerts detected by StoreSathi AI across your inventory & market</p>
        </div>
        <button 
          onClick={fetchOpportunities} 
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
          🔄 Refresh Feed
        </button>
      </header>

      {/* Floating Feedback Banner */}
      {feedback && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))',
          border: '1px solid rgba(16, 185, 129, 0.5)',
          color: '#34d399',
          padding: '14px 20px',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          <div>✓ {feedback.text}</div>
          {feedback.campaignCreated && (
            <button 
              onClick={() => navigate('/campaigns')}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginLeft: '16px'
              }}
            >
              View in Campaigns →
            </button>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'All Opportunities', count: opportunities.length },
          { 
            key: 'growth', 
            label: 'Growth & Campaigns', 
            count: opportunities.filter(o => o.type === 'growth_opportunity' || (o.title && o.title.includes('Growth')) || (o.description && o.description.includes('WhatsApp'))).length 
          },
          { 
            key: 'restock', 
            label: 'Stockouts & Restock', 
            count: opportunities.filter(o => o.type === 'restock' || o.type === 'weather_restock' || (o.title && o.title.includes('Stock'))).length 
          },
          { 
            key: 'discount', 
            label: 'Pricing & Clearance', 
            count: opportunities.filter(o => o.type === 'discount' || (o.title && o.title.includes('Clearance'))).length 
          }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              background: filter === tab.key ? 'var(--brand-primary)' : 'rgba(255, 255, 255, 0.05)',
              color: filter === tab.key ? '#fff' : 'var(--text-secondary)',
              border: '1px solid ' + (filter === tab.key ? 'var(--brand-primary)' : 'var(--glass-border)'),
              padding: '8px 16px',
              borderRadius: '99px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{tab.label}</span>
            <span style={{
              background: filter === tab.key ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
              padding: '1px 7px',
              borderRadius: '99px',
              fontSize: '0.75rem'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚡</div>
          Scanning catalogue and store signals...
        </div>
      ) : filteredOpps.length === 0 ? (
        <div className="empty-state glass-panel">
          <span className="empty-icon">🔍</span>
          <h3>No Opportunities in this filter</h3>
          <p>Your store metrics are well optimized. Visit storefront pages to ingest products and detect live opportunities.</p>
        </div>
      ) : (
        <div className="opp-feed">
          {filteredOpps.map(opp => {
            const pInfo = getPriorityInfo(opp);
            const isApproved = opp.status === 'approved';
            const isGrowth = opp.type === 'growth_opportunity' || 
                            opp.type === 'trend_promotion' || 
                            (opp.title && opp.title.toLowerCase().includes('growth')) ||
                            (opp.description && opp.description.toLowerCase().includes('whatsapp'));

            return (
              <div key={opp.id} className="opp-card glass-panel" style={{ borderLeft: `4px solid ${pInfo.label === 'Urgent' ? '#ef4444' : pInfo.label === 'High' ? '#a855f7' : '#3b82f6'}` }}>
                <div className="opp-header">
                  <div className="opp-title-row">
                    <span className="opp-type-icon">{getTypeIcon(opp.type, opp.title)}</span>
                    <div>
                      <h3 className="opp-product" title={opp.title} style={{ margin: 0 }}>
                        {opp.title}
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Detected: {new Date(opp.created_at || Date.now()).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`badge ${pInfo.cls}`}>{pInfo.label} Priority</span>
                    {isApproved ? (
                      <span className="badge badge-success">Approved ✓</span>
                    ) : (
                      <span className="badge badge-warning">Action Ready</span>
                    )}
                  </div>
                </div>
                
                <div className="opp-details">
                  <p className="draft-reason" style={{ fontSize: '0.95rem', margin: 0 }}>{opp.description}</p>
                </div>

                <div className="opp-footer">
                  <span className="opp-meta" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Type: <strong style={{ color: 'var(--text-primary)' }}>{opp.type ? opp.type.replace(/_/g, ' ').toUpperCase() : 'AI RECOMMENDATION'}</strong>
                  </span>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {isApproved ? (
                      <button 
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'default'
                        }}
                        disabled
                      >
                        ✓ Action Completed & Synced
                      </button>
                    ) : (
                      <button 
                        className="btn-primary" 
                        onClick={() => handleApprove(opp.id, opp.title)}
                        disabled={approvingId === opp.id}
                        style={{
                          background: isGrowth ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'var(--brand-primary)',
                          color: '#fff',
                          padding: '8px 18px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          border: 'none',
                          cursor: approvingId === opp.id ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {approvingId === opp.id ? (
                          'Processing...'
                        ) : isGrowth ? (
                          '🚀 Approve & Launch WhatsApp Campaign'
                        ) : (
                          '⚡ Approve Action'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Opportunities;
