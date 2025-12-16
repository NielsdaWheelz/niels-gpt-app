"use client";

import { useState, useEffect } from "react";
import { StepData, Message } from "@/lib/types";
import { entropyToGlow, getGlowClass } from "@/lib/entropy";
import ControlsBar from "./ControlsBar";
import TokenStream from "./TokenStream";
import TopKBubbles from "./TopKBubbles";
import FullMatrixModal from "./FullMatrixModal";

interface InspectorPaneProps {
  steps: StepData[];
  isStreaming: boolean;
  selectedLayer: number;
  onLayerChange: (layer: number) => void;
  messages: Message[];
  renderMode: "ascii" | "utf-8";
  onRenderModeChange: (mode: "ascii" | "utf-8") => void;
}

export default function InspectorPane({
  steps,
  isStreaming,
  selectedLayer,
  onLayerChange,
  messages,
  renderMode,
  onRenderModeChange,
}: InspectorPaneProps) {
  const [selectedHead, setSelectedHead] = useState(0);
  const [selectedStep, setSelectedStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullMatrix, setShowFullMatrix] = useState(false);

  const maxStep = Math.max(0, steps.length - 1);

  // Reset replay controls when new generation starts
  useEffect(() => {
    if (isStreaming) {
      setIsPlaying(false);
      if (steps.length > 0) {
        setSelectedStep(steps.length - 1);
      }
    }
  }, [isStreaming, steps.length]);

  // Auto-play animation
  useEffect(() => {
    if (!isPlaying || selectedStep >= maxStep) {
      setIsPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setSelectedStep((prev) => Math.min(prev + 1, maxStep));
    }, 200); // 200ms per step

    return () => clearTimeout(timer);
  }, [isPlaying, selectedStep, maxStep]);

  const handlePlayPause = () => {
    if (selectedStep >= maxStep) {
      setSelectedStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const currentStep = steps[selectedStep] || null;
  const confidence = currentStep ? entropyToGlow(currentStep.entropy) : 0;
  const glowClass = currentStep ? getGlowClass(confidence) : "";

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <ControlsBar
        selectedLayer={selectedLayer}
        onLayerChange={onLayerChange}
        selectedHead={selectedHead}
        onHeadChange={setSelectedHead}
        selectedStep={selectedStep}
        onStepChange={setSelectedStep}
        maxStep={maxStep}
        isStreaming={isStreaming}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onFullMatrixToggle={() => setShowFullMatrix(true)}
        renderMode={renderMode}
        onRenderModeChange={onRenderModeChange}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Confidence glow wrapper */}
        <div
          className={`m-4 rounded-lg border border-zinc-800 bg-zinc-900/50 transition-shadow duration-300 ${
            currentStep ? `shadow-lg ${glowClass}` : ""
          }`}
        >
          {/* Token stream */}
          <div className="border-b border-zinc-800">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-mono">token stream</span>
              <span
                className="text-[10px] text-zinc-500 font-mono"
                title="Attention is not an explanation; it's just a distribution over previous tokens"
              >
                ⓘ attention ≠ explanation
              </span>
            </div>
            <TokenStream
              steps={steps}
              selectedStep={selectedStep}
              selectedHead={selectedHead}
              renderMode={renderMode}
            />
          </div>

          {/* Top-K bubbles */}
          <div className="border-b border-zinc-800">
            <TopKBubbles currentStep={currentStep} />
          </div>

          {/* Confidence indicator */}
          {currentStep && (
            <div className="p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-mono">confidence</span>
                <span className="text-zinc-300">
                  {(confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-zinc-500 font-mono">
                entropy: {currentStep.entropy.toFixed(3)}
              </div>
            </div>
          )}
        </div>
      </div>

      <FullMatrixModal
        isOpen={showFullMatrix}
        onClose={() => setShowFullMatrix(false)}
        messages={messages}
        traceLayer={selectedLayer}
        head={selectedHead}
      />
    </div>
  );
}
