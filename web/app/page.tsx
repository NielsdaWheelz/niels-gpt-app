"use client";

import { useState, useRef } from "react";
import {
  Message,
  StepData,
  TokenEvent,
  TraceEvent,
  DoneEvent,
} from "@/lib/types";
import { streamSSE } from "@/lib/sse";
import { API_BASE_URL } from "@/lib/api";
import ChatPane from "@/components/ChatPane";
import InspectorPane from "@/components/InspectorPane";
import Toast from "@/components/Toast";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "you are a helpful assistant. speak in third person about niels.",
    },
  ]);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [assistantCompletion, setAssistantCompletion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [renderMode, setRenderMode] = useState<"ascii" | "utf-8">("ascii");
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setSteps([]);
    setAssistantCompletion("");
    setIsStreaming(true);
    setError(null);

    const tempSteps: StepData[] = [];
    const tokenEvents: TokenEvent[] = [];
    const traceEvents: TraceEvent[] = [];

    abortControllerRef.current = new AbortController();

    try {
      await streamSSE(
        `${API_BASE_URL}/chat/stream`,
        {
          messages: newMessages,
          max_new_tokens: 256,
          temperature: 0.9,
          top_k: 50,
          seed: 42,
          trace_layer: selectedLayer,
        },
        (event) => {
          if (event.event === "token") {
            const tokenData = event.data as TokenEvent;
            tokenEvents.push(tokenData);
            setAssistantCompletion((prev) => prev + tokenData.token_text);
          } else if (event.event === "trace") {
            const traceData = event.data as TraceEvent;
            traceEvents.push(traceData);

            // Merge token and trace data
            const matchingToken = tokenEvents.find(
              (t) => t.step === traceData.step
            );
            if (matchingToken) {
              const stepData: StepData = {
                step: traceData.step,
                token_id: matchingToken.token_id,
                token_text: matchingToken.token_text,
                token_display: matchingToken.token_display,
                entropy: traceData.entropy,
                topk: traceData.topk,
                attn: traceData.attn,
              };
              tempSteps.push(stepData);
              setSteps([...tempSteps]);
            }
          } else if (event.event === "done") {
            const doneData = event.data as DoneEvent;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: doneData.reply },
            ]);
            setAssistantCompletion("");
          }
        },
        (err) => {
          setError(err.message);
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      if (err instanceof Error) {
        // Check for specific error codes
        if (err.message.includes("prompt_too_large")) {
          setError("Prompt too large. Please reduce message length.");
        } else if (err.message.includes("rate_limited")) {
          setError("Rate limited. Please wait before sending another message.");
        } else if (err.message !== "The user aborted a request.") {
          setError(err.message);
        }
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);

    // Append partial completion to chat history
    if (assistantCompletion) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: assistantCompletion },
      ]);
      setAssistantCompletion("");
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left: Inspector */}
      <div className="w-1/2 h-full border-r border-zinc-800">
        <InspectorPane
          steps={steps}
          isStreaming={isStreaming}
          selectedLayer={selectedLayer}
          onLayerChange={setSelectedLayer}
          messages={messages}
          renderMode={renderMode}
          onRenderModeChange={setRenderMode}
        />
      </div>

      {/* Right: Chat */}
      <div className="w-1/2 h-full">
        <ChatPane
          messages={messages.slice(1)} // Skip system message in display
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          onStop={handleStop}
          assistantCompletion={assistantCompletion}
        />
      </div>

      {/* Error toast */}
      <Toast message={error} type="error" onClose={() => setError(null)} />
    </div>
  );
}
