import { useState, useEffect } from 'react';
import './Campaigns.css';

const PRESETS = [
  { id: 'diwali', label: '🪔 Diwali Dhamaka', occasion: 'Diwali Festive Dhamaka', discount: 15 },
  { id: 'weekend', label: '⚡ Weekend Rush', occasion: 'Weekend Kirana Rush', discount: 10 },
  { id: 'loyalty', label: '🎁 VIP Reward', occasion: 'Paytm VIP Loyalty Reward', discount: 5 },
  { id: 'clearance', label: '🏷️ Stock Clearance', occasion: 'Stale Stock Clearance', discount: 20 },
];

const Campaigns = () => {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [activePreset, setActivePreset] = useState(PRESETS[0].id);
  const [occasion, setOccasion] = useState(PRESETS[0].occasion);
  const [discountPct, setDiscountPct] = useState(PRESETS[0].discount);
  const [audienceTier, setAudienceTier] = useState('VIP Regular');
  
  const [generatedCampaign, setGeneratedCampaign] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState(null);

  useEffect(() => {
    fetchMetrics();
    fetchHistory();
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`/api/campaigns/audience?store_id=${encodeURIComponent(localStorage.getItem('portal_storeId') || 'store_1')}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to fetch metrics', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/campaigns/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const handlePresetSelect = (preset) => {
    setActivePreset(preset.id);
    setOccasion(preset.occasion);
    setDiscountPct(preset.discount);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setBroadcastStatus(null);
    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, discount_pct: discountPct, store_name: localStorage.getItem('portal_storeName') || 'StoreSathi Supermart' })
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedCampaign(data.campaign);
      }
    } catch (err) {
      console.error('Generation failed', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBroadcast = async () => {
    if (!generatedCampaign) return;
    
    setIsBroadcasting(true);
    try {
      const res = await fetch('/api/campaigns/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign: generatedCampaign,
          audience_tier: audienceTier,
          store_id: localStorage.getItem('portal_storeId') || 'store_1'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBroadcastStatus({ type: 'success', message: data.message });
        fetchHistory(); // Refresh history
      } else {
        setBroadcastStatus({ type: 'error', message: data.error || 'Broadcast failed' });
      }
    } catch (err) {
      setBroadcastStatus({ type: 'error', message: 'Network error during broadcast' });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const audienceCount = metrics?.audience_tiers?.[audienceTier] || 0;

  return (
    <div className="campaigns-container animate-fade-in">
      <div className="campaigns-header">
        <h1>Growth & Campaigns</h1>
        {metrics && (
          <div className="loyalty-metrics">
            <div className="metric-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              {metrics.total_customers} Paytm Loyal Customers
            </div>
            <div className="metric-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              Avg Spend ₹{metrics.avg_ticket_size}
            </div>
          </div>
        )}
      </div>

      <div className="campaign-grid">
        {/* Left Column: AI Studio Controls */}
        <div className="studio-card glass-panel">
          <h2 className="studio-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            AI Campaign Generator
          </h2>
          
          <div className="preset-buttons">
            {PRESETS.map(preset => (
              <button 
                key={preset.id}
                className={`preset-btn ${activePreset === preset.id ? 'active' : ''}`}
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label>Occasion / Theme</label>
            <input 
              type="text" 
              className="form-control" 
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Discount Percentage (%)</label>
            <input 
              type="number" 
              className="form-control" 
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
              min="0" max="100"
            />
          </div>

          <button 
            className="generate-btn" 
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? '✨ Generating...' : '✨ Generate AI Campaign'}
          </button>
        </div>

        {/* Right Column: Live Preview & Broadcast */}
        {generatedCampaign ? (
          <div className="preview-container">
            <div className={`visual-banner theme-${generatedCampaign.banner_style}`}>
              <h2>{generatedCampaign.title}</h2>
              <div className="discount-badge">Flat {generatedCampaign.discount_pct}% OFF</div>
              <p>Exclusive offer for our regular Paytm customers!</p>
            </div>

            <div className="wa-preview">
              <div className="wa-bubble">
                {generatedCampaign.copy_text}
              </div>
            </div>

            <div className="broadcast-actions">
              <div className="form-group">
                <label>Target Audience (Paytm Loyalty Segment)</label>
                <select 
                  className="form-control" 
                  value={audienceTier}
                  onChange={(e) => setAudienceTier(e.target.value)}
                >
                  <option value="VIP Regular">VIP Regulars ({metrics?.audience_tiers?.['VIP Regular'] || 0} customers)</option>
                  <option value="Regular">Regulars & VIPs ({(metrics?.audience_tiers?.['VIP Regular'] || 0) + (metrics?.audience_tiers?.['Regular'] || 0)} customers)</option>
                  <option value="All">All Tracked Customers ({metrics?.total_customers || 0} customers)</option>
                </select>
              </div>

              <button 
                className="broadcast-btn" 
                onClick={handleBroadcast}
                disabled={isBroadcasting || audienceCount === 0}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                {isBroadcasting ? 'Broadcasting...' : `Broadcast to ${audienceCount || 'selected'} customers`}
              </button>

              {broadcastStatus && (
                <div className="status-alert" style={{ color: broadcastStatus.type === 'error' ? 'red' : 'inherit' }}>
                  {broadcastStatus.type === 'success' ? '✅ ' : '❌ '}
                  {broadcastStatus.message}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="preview-container" style={{ justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            <p>Generate a campaign to see the preview</p>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="history-section glass-panel" style={{ padding: '2rem' }}>
          <h3>Past Campaigns</h3>
          <div className="history-list">
            {history.map(c => (
              <div key={c.id} className="history-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border-glass)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.title}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span className="metric-badge">{c.recipients_count} recipients</span>
                  <span className="metric-badge" style={{ background: c.status === 'sent' || c.status === 'simulated' ? 'rgba(168, 230, 207, 0.2)' : 'rgba(255, 182, 193, 0.2)' }}>
                    {c.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
