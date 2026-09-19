import { useState } from 'react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
      const bodyPayload = isSignup ? { email, password, store_name: storeName } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (res.ok && data.user) {
        onLogin(data.user);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel animate-fade-in">
        <div className="login-header">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <h2 className="text-gradient">StoreSathi</h2>
          <p>{isSignup ? 'Create a Merchant Account' : 'Merchant Portal Login'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isSignup && (
            <div className="form-group">
              <label>Store Name</label>
              <input 
                type="text" 
                value={storeName} 
                onChange={(e) => setStoreName(e.target.value)} 
                placeholder="My Awesome Store" 
                required={isSignup}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="demo@storesathi.com" 
              required 
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="demo123" 
              required 
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? 'Processing...' : (isSignup ? 'Sign Up' : 'Secure Login')}
          </button>
        </form>

        <div className="login-footer">
          <p style={{ cursor: 'pointer', color: 'var(--brand-primary)', textDecoration: 'underline' }} onClick={() => { setIsSignup(!isSignup); setError(null); }}>
            {isSignup ? 'Already have an account? Log in' : "Don't have an account? Sign Up"}
          </p>
          {!isSignup && <p style={{ marginTop: '0.5rem' }}>Try: demo@storesathi.com / demo123</p>}
        </div>
      </div>
    </div>
  );
};

export default Login;
