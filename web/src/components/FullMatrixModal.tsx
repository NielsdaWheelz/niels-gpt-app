"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Message, FullAttentionResponse } from "@/lib/types";
import { fetchFullAttention } from "@/lib/api";

interface FullMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  traceLayer: number;
  head: number;
}

export default function FullMatrixModal({
  isOpen,
  onClose,
  messages,
  traceLayer,
  head,
}: FullMatrixModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<FullAttentionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchFullAttention({
          messages,
          trace_layer: traceLayer,
          head,
        });
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load matrix");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, messages, traceLayer, head]);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { attn, tokens_display } = data;

    // Cap rendering to last 128 tokens for performance
    const maxTokens = 128;
    const startIdx = Math.max(0, attn.length - maxTokens);
    const slicedAttn = attn.slice(startIdx);
    const slicedTokens = tokens_display.slice(startIdx);
    const seqLen = slicedAttn.length;

    // Canvas dimensions
    const cellSize = 4;
    const labelWidth = 60;
    const labelHeight = 20;
    const width = seqLen * cellSize + labelWidth;
    const height = seqLen * cellSize + labelHeight;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = "#18181b"; // zinc-900
    ctx.fillRect(0, 0, width, height);

    // Find global min/max for normalization
    let minAttn = Infinity;
    let maxAttn = -Infinity;
    for (const row of slicedAttn) {
      for (const val of row) {
        minAttn = Math.min(minAttn, val);
        maxAttn = Math.max(maxAttn, val);
      }
    }

    // Draw heatmap
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < seqLen; j++) {
        const value = slicedAttn[i][j];
        const normalized = (value - minAttn) / (maxAttn - minAttn || 1);

        // Color scale: blue (low) -> white (mid) -> yellow (high)
        let r, g, b;
        if (normalized < 0.5) {
          // Blue to white
          const t = normalized * 2;
          r = Math.floor(59 + (255 - 59) * t);
          g = Math.floor(130 + (255 - 130) * t);
          b = Math.floor(246 + (255 - 246) * t);
        } else {
          // White to yellow
          const t = (normalized - 0.5) * 2;
          r = 255;
          g = Math.floor(255 - (255 - 234) * t);
          b = Math.floor(255 - (255 - 179) * t);
        }

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(
          labelWidth + j * cellSize,
          labelHeight + i * cellSize,
          cellSize,
          cellSize
        );
      }
    }

    // Draw labels (abbreviated)
    ctx.fillStyle = "#a1a1aa"; // zinc-400
    ctx.font = "8px monospace";

    // Top labels (query positions) - every 10th
    for (let j = 0; j < seqLen; j += 10) {
      const token = slicedTokens[j].slice(0, 3);
      ctx.save();
      ctx.translate(labelWidth + j * cellSize + 2, labelHeight - 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(token, 0, 0);
      ctx.restore();
    }

    // Left labels (key positions) - every 10th
    for (let i = 0; i < seqLen; i += 10) {
      const token = slicedTokens[i].slice(0, 3);
      ctx.fillText(token, 2, labelHeight + i * cellSize + 8);
    }

  }, [data]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Full Attention Matrix
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  layer {traceLayer}, head {head}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              {loading && (
                <div className="text-center py-8 text-zinc-400">
                  Loading matrix...
                </div>
              )}
              {error && (
                <div className="text-center py-8 text-red-400">
                  Error: {error}
                </div>
              )}
              {data && !loading && (
                <div className="overflow-auto">
                  <div className="mb-2 text-xs text-zinc-400">
                    {data.tokens_display.length} tokens
                    {data.tokens_display.length > 128 &&
                      " (showing last 128)"}
                  </div>
                  <canvas
                    ref={canvasRef}
                    className="border border-zinc-700"
                  />
                  <div className="mt-2 text-xs text-zinc-500">
                    rows: query positions, cols: key positions
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
