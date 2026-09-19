import { useState, useRef, useEffect } from 'react';
import './CopilotPage.css';

const CopilotPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const fetchHistory = async () => {
      const storeId = localStorage.getItem('portal_storeId') || 'store_1';
      try {
        const res = await fetch(`/api/intelligence/copilot/history?store_id=${storeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setMessages(data.map(m => ({ role: m.role, text: m.content, source: m.source })));
          } else {
            setMessages([{ role: 'assistant', text: 'Hi! I am the StoreSathi AI Copilot. Ask me anything about your sales, inventory, or recent alerts.' }]);
          }
        }
      } catch (err) {
        console.error('Failed to load history', err);
        setMessages([{ role: 'assistant', text: 'Hi! I am the StoreSathi AI Copilot.' }]);
      }
    };
    fetchHistory();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    const storeId = localStorage.getItem('portal_storeId') || 'store_1';
    
    try {
      const res = await fetch(`/api/intelligence/copilot/chat?store_id=${storeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: data.reply || 'Sorry, I encountered an error.',
        source: data.source 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Network error reaching the Copilot.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="copilot-page animate-fade-in">
      <header className="page-header">
        <h1>StoreSathi AI Copilot</h1>
        <p className="subtitle">Your intelligent retail assistant</p>
      </header>

      <div className="chat-container glass-panel">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <div className="msg-bubble">
                {msg.text}
              </div>
              {msg.source === 'groq_llama3' && (
                <div className="msg-source">⚡ Powered by Groq Llama-3</div>
              )}
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="msg-bubble typing">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input 
            type="text" 
            placeholder="Ask about your store..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" disabled={!input.trim() || loading}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default CopilotPage;
