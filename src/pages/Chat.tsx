import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage } from '../services/api';
import './Chat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SAMPLE_QUESTIONS = [
  "What is the overall utilization rate for each department?",
  "Which rooms are underutilized and could potentially be consolidated?",
  "Does Architecture need an additional drafting room based on the data?",
  "What are the peak usage hours across all facilities?",
  "How has enrollment changed from Fall 2023 to Fall 2025?",
  "Which Technology rooms should be prioritized for the Building 6 move?",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendChatMessage(userMessage.content, history);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSampleQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <h2>AI Assistant</h2>
          <p>Ask questions about classroom utilization and scheduling data</p>
        </div>

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h3>Welcome to MDC Scheduling AI Assistant</h3>
              <p>
                I can help you analyze classroom utilization data, identify trends,
                and make recommendations for the Fall 2026 reorganization.
              </p>
              <div className="sample-questions">
                <h4>Try asking:</h4>
                <div className="questions-grid">
                  {SAMPLE_QUESTIONS.map((question, idx) => (
                    <button
                      key={idx}
                      className="sample-question"
                      onClick={() => handleSampleQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.role}`}
            >
              <div className="message-header">
                <span className="message-role">
                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                </span>
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">
                {message.role === 'assistant' ? (
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message assistant loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about classroom utilization, enrollment trends, or recommendations..."
            disabled={loading}
            rows={2}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
