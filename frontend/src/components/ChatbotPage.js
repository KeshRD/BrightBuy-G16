import React, { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useNavigate } from "react-router-dom";
import "./ChatbotPage.css"; // 👈 import the CSS file

const API_KEY = 'AIzaSyDjfxGgrb8gJcMNPVGHDvc27BIuS17nZhs';

const ChatbotPage = () => {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      content:
        "👋 Hello Dear Customer! I'm your AI assistant powered by BrightBuy. Ask me anything about our products 🤠",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const genAI = useRef(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
      return;
    }

    try {
      genAI.current = new GoogleGenerativeAI(API_KEY);
      setIsInitialized(true);
    } catch (err) {
      setError("Failed to initialize AI model. Please try again later.");
      setIsInitialized(false);
    }
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !genAI.current || !isInitialized) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError("");

    try {
      const model = genAI.current.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(input);
      const aiResponse = await result.response.text();
      setMessages((prev) => [...prev, { role: "ai", content: aiResponse }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "❌ Error generating response." },
      ]);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbot-container">
      {/* Header */}
      <div className="chatbot-header">
        <h2>BrightBuy AI Chatbot 💬</h2>
        <button onClick={() => navigate("/home")}>⬅ Back</button>
      </div>

      {/* Messages */}
      <div className="chatbot-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message-row ${msg.role}`}>
            <div className={`message-bubble ${msg.role}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message-row ai">
            <div className="message-bubble ai typing">Typing...</div>
          </div>
        )}

        {error && (
          <div className="error-text">{error}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chatbot-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          rows={1}
          disabled={isLoading || !isInitialized}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim() || !isInitialized}
        >
          Send 🚀
        </button>
      </div>
    </div>
  );
};

export default ChatbotPage;
