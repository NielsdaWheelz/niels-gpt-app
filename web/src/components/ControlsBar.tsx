"use client";

interface ControlsBarProps {
  selectedLayer: number;
  onLayerChange: (layer: number) => void;
  selectedHead: number;
  onHeadChange: (head: number) => void;
  selectedStep: number;
  onStepChange: (step: number) => void;
  maxStep: number;
  isStreaming: boolean;
  isPlaying: boolean;
  onPlayPause: () => void;
  onFullMatrixToggle: () => void;
  renderMode: "ascii" | "utf-8";
  onRenderModeChange: (mode: "ascii" | "utf-8") => void;
}

export default function ControlsBar({
  selectedLayer,
  onLayerChange,
  selectedHead,
  onHeadChange,
  selectedStep,
  onStepChange,
  maxStep,
  isStreaming,
  isPlaying,
  onPlayPause,
  onFullMatrixToggle,
  renderMode,
  onRenderModeChange,
}: ControlsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-zinc-800/50 border-b border-zinc-700">
      {/* Layer dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-400 font-mono">layer</label>
        <select
          value={selectedLayer}
          onChange={(e) => onLayerChange(Number(e.target.value))}
          className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {[0, 1, 2, 3].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* Head dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-400 font-mono">head</label>
        <select
          value={selectedHead}
          onChange={(e) => onHeadChange(Number(e.target.value))}
          className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {[0, 1, 2, 3].map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      {/* Render mode toggle */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-400 font-mono">render mode</label>
        <select
          value={renderMode}
          onChange={(e) => onRenderModeChange(e.target.value as "ascii" | "utf-8")}
          className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="ascii">ascii</option>
          <option value="utf-8">utf-8</option>
        </select>
      </div>

      {/* Full matrix button */}
      <button
        onClick={onFullMatrixToggle}
        disabled={maxStep === 0}
        className="px-3 py-1 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 disabled:bg-zinc-700/20 disabled:border-zinc-600/30 disabled:text-zinc-500 rounded text-sm transition-colors"
      >
        full matrix
      </button>

      <div className="flex-1" />

      {/* Replay controls */}
      <div className="flex items-center gap-3">
        {isStreaming ? (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="font-mono">live</span>
          </div>
        ) : (
          <>
            <button
              onClick={onPlayPause}
              disabled={maxStep === 0}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-600 rounded text-sm transition-colors"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="text-xs text-zinc-400 font-mono">
                {selectedStep}
              </span>
              <input
                type="range"
                min={0}
                max={maxStep}
                value={selectedStep}
                onChange={(e) => onStepChange(Number(e.target.value))}
                disabled={maxStep === 0}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs text-zinc-400 font-mono">{maxStep}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
