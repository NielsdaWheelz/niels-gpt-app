"use client";

import { motion } from "framer-motion";
import { StepData } from "@/lib/types";

interface TopKBubblesProps {
  currentStep: StepData | null;
}

export default function TopKBubbles({ currentStep }: TopKBubblesProps) {
  if (!currentStep || !currentStep.topk || currentStep.topk.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500 text-xs">
        no top-k data
      </div>
    );
  }

  const { topk, token_id } = currentStep;

  return (
    <div className="p-4">
      <div className="text-xs text-zinc-400 mb-2 font-mono">
        top-k candidates
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {topk.map((candidate, idx) => {
          const isChosen = candidate.token_id === token_id;
          const size = 60 + candidate.prob * 80; // 60-140px based on probability

          return (
            <motion.div
              key={idx}
              className={`rounded-full flex flex-col items-center justify-center border-2 ${
                isChosen
                  ? "border-emerald-500 bg-emerald-600/30"
                  : "border-zinc-600 bg-zinc-700/30"
              }`}
              style={{
                width: size,
                height: size,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: isChosen ? [1, 1.3, 1.1] : 1,
                opacity: 1,
              }}
              transition={{
                duration: 0.5,
                ease: "easeOut",
              }}
            >
              <div
                className={`text-xs font-mono ${
                  isChosen ? "text-emerald-200" : "text-zinc-300"
                }`}
              >
                {candidate.token_display}
              </div>
              <div
                className={`text-[10px] mt-1 ${
                  isChosen ? "text-emerald-400" : "text-zinc-500"
                }`}
              >
                {(candidate.prob * 100).toFixed(1)}%
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
