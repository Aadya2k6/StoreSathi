import { useState, useEffect } from 'react';
import './History.css';

function History() {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/snapshots')
      .then(res => res.json())
      .then(data => {
        setSnapshots(data.data || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', { 
      month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="history-container animate-fade-in">
      <header className="page-header">
        <h1>Ingestion History</h1>
        <p className="subtitle">Audit log of products tracked by StoreSathi</p>
      </header>

      <div className="glass-panel table-container">
        {loading ? (
          <div className="loading-state">Loading history...</div>
        ) : snapshots.length === 0 ? (
          <div className="empty-state">No history recorded yet.</div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Product</th>
                <th>Price</th>
                <th>Reviews</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map(snap => (
                <tr key={snap.id}>
                  <td className="time-cell">{formatDate(snap.timestamp)}</td>
                  <td className="product-cell">
                    <a href={snap.url} target="_blank" rel="noreferrer">{snap.product_name}</a>
                  </td>
                  <td className="price-cell">{snap.currency} {snap.price}</td>
                  <td className="review-cell">
                    {snap.reviews_count} <span className="rating-star">★ {snap.rating}</span>
                  </td>
                  <td>
                    <span className={`status-dot ${snap.stock_status === 'in_stock' ? 'in-stock' : 'out-stock'}`}></span>
                    {snap.stock_status.replace('_', ' ')}
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

export default History;
