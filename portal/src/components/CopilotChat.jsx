import { useState, useRef, useEffect } from 'react';
import './CopilotChat.css';

const CopilotChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am the StoreSathi AI Copilot. Ask me anything about your sales, inventory, or recent alerts.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    <div className={`copilot-widget ${isOpen ? 'open' : ''}`}>
      {!isOpen && (
        <button className="copilot-fab animate-fade-in" onClick={() => setIsOpen(true)}>
          <span className="sparkle">✨</span>
        </button>
      )}

      {isOpen && (
        <div className="copilot-window glass-panel">
          <div className="copilot-header">
            <div className="header-left">
              <span className="sparkle">✨</span>
              <h3>StoreSathi Copilot</h3>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>&times;</button>
          </div>

          <div className="copilot-messages">
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

          <form className="copilot-input" onSubmit={handleSend}>
            <input 
              type="text" 
              placeholder="Ask about your store..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" disabled={!input.trim() || loading}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default CopilotChat;
