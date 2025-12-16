"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Message } from "@/lib/types";

interface ChatPaneProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  assistantCompletion: string;
}

export default function ChatPane({
  messages,
  onSendMessage,
  isStreaming,
  onStop,
  assistantCompletion,
}: ChatPaneProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantCompletion]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSendMessage(input);
    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-blue-600/20 border border-blue-500/30"
                  : msg.role === "assistant"
                  ? "bg-emerald-600/20 border border-emerald-500/30"
                  : "bg-zinc-700/30 border border-zinc-600/30"
              }`}
            >
              <div className="text-xs text-zinc-400 mb-1 font-mono">
                {msg.role}
              </div>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {/* Show streaming assistant response */}
        {isStreaming && assistantCompletion && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-emerald-600/20 border border-emerald-500/30">
              <div className="text-xs text-zinc-400 mb-1 font-mono">
                assistant
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {assistantCompletion}
                <span className="inline-block w-2 h-4 bg-emerald-500 ml-1 animate-pulse" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 max-h-32 overflow-y-auto"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              onClick={onStop}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
