import './Settings.css';

function Settings() {
  return (
    <div className="settings-container animate-fade-in">
      <header className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Configure your StoreSathi preferences</p>
      </header>

      <div className="settings-grid">
        <section className="settings-section glass-panel">
          <h2>Notification Preferences</h2>
          <div className="form-group">
            <label>WhatsApp Number</label>
            <input type="text" className="form-control" defaultValue="+1 (555) 162-2579" />
            <p className="help-text">The number that receives interactive StoreSathi alerts.</p>
          </div>
          <div className="form-group toggle-group">
            <label className="toggle-label">
              <input type="checkbox" defaultChecked className="toggle-input" />
              <span className="toggle-slider"></span>
              <span className="toggle-text">Enable Tier B Auto-execution (Coming Soon)</span>
            </label>
          </div>
        </section>

        <section className="settings-section glass-panel">
          <h2>Opportunity Engine</h2>
          <div className="form-group">
            <label>Price Watch Threshold (%)</label>
            <input type="number" className="form-control" defaultValue="5" />
            <p className="help-text">Alert if price drops by this percentage.</p>
          </div>
          <div className="form-group">
            <label>Competitor Analysis</label>
            <select className="form-control">
              <option>Aggressive (Daily)</option>
              <option>Balanced (Weekly)</option>
              <option>Conservative (Monthly)</option>
            </select>
          </div>
        </section>
      </div>
      
      <div className="settings-actions">
        <button className="btn-primary">Save Changes</button>
      </div>
    </div>
  );
}

export default Settings;
