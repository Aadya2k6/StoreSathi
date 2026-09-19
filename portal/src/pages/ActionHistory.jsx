import { useState, useEffect } from 'react';
import './ActionHistory.css';

function ActionHistory() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = () => {
    setLoading(true);
    const storeId = localStorage.getItem('portal_storeId') || 'store_1';
    fetch(`/api/intelligence/actions?store_id=${storeId}`)
      .then(res => res.json())
      .then(data => {
        setActions(data.data || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchActions();
    window.addEventListener('storeIdChanged', fetchActions);
    return () => window.removeEventListener('storeIdChanged', fetchActions);
  }, []);

  const formatDate = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', { 
      month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const getBadgeClass = (type) => {
    if (type.includes('restock')) return 'badge-restock';
    if (type.includes('promotion') || type.includes('discount')) return 'badge-promo';
    return 'badge-default';
  };

  return (
    <div className="action-history-container animate-fade-in">
      <header className="page-header">
        <h1>Approved Actions</h1>
        <p className="subtitle">History of AI recommendations you have approved</p>
      </header>

      <div className="glass-panel table-container">
        {loading ? (
          <div className="loading-state">Loading action history...</div>
        ) : actions.length === 0 ? (
          <div className="empty-state">No actions approved yet. Use the StoreSathi Chrome extension to approve insights!</div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Executed At</th>
                <th>Action Title</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {actions.map(action => (
                <tr key={action.id}>
                  <td className="time-cell">{formatDate(action.executed_at)}</td>
                  <td className="title-cell">
                    <strong>{action.title}</strong>
                    <p className="desc-preview">{action.description}</p>
                  </td>
                  <td className="type-cell">
                    <span className={`badge ${getBadgeClass(action.type)}`}>
                      {action.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="status-cell">
                    <span className="status-badge success">✔ {action.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ActionHistory;
