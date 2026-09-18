import { useState, useEffect } from 'react';
import './Opportunities.css';

function Opportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/opportunities')
      .then(res => res.json())
      .then(data => {
        setOpportunities(data.data || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSendWhatsApp = async (id) => {
    try {
      const res = await fetch(`/api/opportunities/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('WhatsApp Alert Sent! wamid: ' + data.wamid);
        // Optimistically update status to 'sent_for_approval'
        setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: 'sent_for_approval' } : o));
      } else {
        alert('Failed to send: ' + data.error);
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'drafted': return <span className="badge badge-warning">Drafted</span>;
      case 'sent_for_approval': return <span className="badge badge-info">Pending Approval</span>;
      case 'approved': return <span className="badge badge-success">Approved</span>;
      case 'rejected': return <span className="badge badge-error">Rejected</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'underpriced': return '📈';
      case 'slow_moving': return '📦';
      case 'response_gap': return '💬';
      case 'price_watch': return '👁️';
      default: return '✨';
    }
  };

  return (
    <div className="opp-container animate-fade-in">
      <header className="page-header">
        <h1>Opportunities Feed</h1>
        <p className="subtitle">Actionable intelligence detected across the web</p>
      </header>

      {loading ? (
        <div className="loading-state">Scanning the market...</div>
      ) : opportunities.length === 0 ? (
        <div className="empty-state glass-panel">
          <span className="empty-icon">🔍</span>
          <h3>No Opportunities Yet</h3>
          <p>Ingest products via the Chrome Extension to see alerts here.</p>
        </div>
      ) : (
        <div className="opp-feed">
          {opportunities.map(opp => (
            <div key={opp.id} className="opp-card glass-panel">
              <div className="opp-header">
                <div className="opp-title-row">
                  <span className="opp-type-icon">{getTypeIcon(opp.type)}</span>
                  <h3 className="opp-product" title={opp.product_name}>
                    {opp.product_name}
                  </h3>
                </div>
                {getStatusBadge(opp.status)}
              </div>
              
              <div className="opp-details">
                {opp.details?.draft ? (
                  <>
                    <h4 className="draft-headline">{opp.details.draft.headline}</h4>
                    <p className="draft-reason">{opp.details.draft.reason}</p>
                    <div className="draft-action"><strong>Action:</strong> {opp.details.draft.action}</div>
                  </>
                ) : (
                  <p className="draft-reason">Opportunity detected but no draft was generated yet.</p>
                )}
              </div>

              <div className="opp-footer">
                <span className="opp-meta">
                  <a href={opp.url} target="_blank" rel="noreferrer" className="meta-link">View Source ↗</a>
                </span>
                
                {opp.status === 'drafted' && (
                  <button 
                    className="btn-primary" 
                    onClick={() => handleSendWhatsApp(opp.id)}
                  >
                    Send WhatsApp Alert
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Opportunities;
