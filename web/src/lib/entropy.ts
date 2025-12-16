/**
 * Convert entropy to a confidence glow intensity
 * Lower entropy = higher confidence = stronger glow
 */
export function entropyToGlow(entropy: number): number {
  // Normalize entropy to 0-1 range (assuming max entropy ~3 for byte-level)
  const normalized = Math.max(0, Math.min(1, entropy / 3));
  // Invert: low entropy = high confidence
  const confidence = 1 - normalized;
  return confidence;
}

/**
 * Get color class for confidence glow
 */
export function getGlowClass(confidence: number): string {
  if (confidence > 0.8) return "shadow-emerald-500/40";
  if (confidence > 0.5) return "shadow-blue-500/30";
  if (confidence > 0.3) return "shadow-amber-500/20";
  return "shadow-red-500/10";
}
