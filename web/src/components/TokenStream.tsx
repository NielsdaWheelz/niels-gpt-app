"use client";

import { motion } from "framer-motion";
import { StepData } from "@/lib/types";

interface TokenStreamProps {
  steps: StepData[];
  selectedStep: number;
  selectedHead: number;
  renderMode: "ascii" | "utf-8";
}

// Helper: check if token_id is printable ASCII (32-126)
function asciiChar(tokenId: number): string {
  if (tokenId >= 32 && tokenId <= 126) {
    return String.fromCharCode(tokenId);
  }
  return "·"; // middle dot placeholder
}

export default function TokenStream({
  steps,
  selectedStep,
  selectedHead,
  renderMode,
}: TokenStreamProps) {
  if (steps.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-500 text-sm">
        waiting for generation...
      </div>
    );
  }

  const currentStep = steps[selectedStep];
  if (!currentStep) return null;

  // Get attention weights for the selected head
  const attnRow = currentStep.attn[selectedHead] || [];

  // Attention row is over full context (prompt + generation)
  // We only display generation tokens, so align indices
  const t = attnRow.length; // total context length
  const genLen = selectedStep + 1; // generated tokens so far
  const promptLen = Math.max(0, t - genLen);

  // Get weights for generation tokens only (last genLen positions)
  const genWeights = attnRow.slice(promptLen);

  // Use raw attention weights (already sum to 1 via softmax)
  // Apply sqrt for perceptual contrast without lying about distribution
  const contrastTransform = (w: number) => Math.sqrt(w);

  // Find top-3 attention values for pulse effect
  const sortedIndices = genWeights
    .map((w, i) => ({ w, i }))
    .filter((x) => x.i < selectedStep) // exclude current token
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => x.i);
  const top3Set = new Set(sortedIndices);

  // Build UTF-8 decoded completion from token_text
  const decodedCompletion = steps
    .slice(0, selectedStep + 1)
    .map((s) => s.token_text)
    .join("");

  if (renderMode === "utf-8") {
    // UTF-8 mode: primary = decoded track, secondary = deemphasized token boxes
    return (
      <div className="p-4 space-y-3">
        {/* Decoded UTF-8 track (primary) */}
        <div>
          <div className="text-[10px] text-zinc-500 font-mono mb-1">
            utf-8 view (best-effort; bytes are ground truth)
          </div>
          <pre className="bg-zinc-800/50 border border-zinc-700 rounded p-3 text-sm font-mono whitespace-pre-wrap break-words">
            {decodedCompletion}
          </pre>
        </div>

        {/* Token boxes (secondary, deemphasized) */}
        <div>
          <div className="text-[10px] text-zinc-500 font-mono mb-1">
            token stream (byte-level)
          </div>
          <div className="flex flex-wrap gap-1 items-center opacity-50 scale-95">
            {steps.slice(0, selectedStep + 1).map((step, idx) => {
              const attnWeight = genWeights[idx] || 0;
              const transformed = contrastTransform(attnWeight);
              const opacity = 0.3 + transformed * 0.7;
              const isCurrent = idx === selectedStep;
              const shouldPulse = top3Set.has(idx);

              return (
                <motion.span
                  key={idx}
                  className={`px-2 py-1 rounded text-xs font-mono relative ${
                    isCurrent
                      ? "bg-blue-600/30 border border-blue-500/50"
                      : "bg-zinc-700/50"
                  }`}
                  style={{
                    opacity: isCurrent ? 1 : opacity,
                  }}
                  animate={
                    shouldPulse
                      ? {
                          scale: [1, 1.05, 1],
                        }
                      : {}
                  }
                  transition={{
                    duration: 1,
                    repeat: shouldPulse ? Infinity : 0,
                    ease: "easeInOut",
                  }}
                >
                  {step.token_display}
                </motion.span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ASCII mode: primary = ASCII char track with attention highlighting
  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-1 items-center">
        {steps.slice(0, selectedStep + 1).map((step, idx) => {
          const attnWeight = genWeights[idx] || 0;
          const transformed = contrastTransform(attnWeight);
          const opacity = 0.3 + transformed * 0.7;
          const isCurrent = idx === selectedStep;

          // Pulse the top-3 attended tokens
          const shouldPulse = top3Set.has(idx);

          return (
            <motion.span
              key={idx}
              title={step.token_display} // hover shows \xNN etc
              className={`px-2 py-1 rounded text-sm font-mono relative ${
                isCurrent
                  ? "bg-blue-600/30 border border-blue-500/50 ring-2 ring-blue-500/30"
                  : "bg-zinc-700/50"
              }`}
              style={{
                opacity: isCurrent ? 1 : opacity,
              }}
              animate={
                shouldPulse
                  ? {
                      scale: [1, 1.1, 1],
                      backgroundColor: [
                        "rgba(59, 130, 246, 0.2)",
                        "rgba(59, 130, 246, 0.4)",
                        "rgba(59, 130, 246, 0.2)",
                      ],
                    }
                  : {}
              }
              transition={{
                duration: 1,
                repeat: shouldPulse ? Infinity : 0,
                ease: "easeInOut",
              }}
            >
              {asciiChar(step.token_id)}
              {isCurrent && (
                <motion.div
                  className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [1, 0.5, 1],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                  }}
                />
              )}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}
