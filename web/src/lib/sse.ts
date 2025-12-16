import { SSEEvent } from "./types";

/**
 * SSE parser for POST requests
 * EventSource API cannot POST, so we parse the stream manually
 */
export async function streamSSE(
  url: string,
  body: any,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: Error) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      // Handle error responses (413, 429, etc.)
      // Try JSON first, fallback to text (proxies/502s may return HTML)
      let msg = `HTTP ${response.status}`;
      try {
        const j = await response.json();
        msg = j.error || msg;
      } catch {
        const text = await response.text();
        msg = text || msg;
      }
      throw new Error(msg);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "message"; // SSE spec default
    let currentDataLines: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Normalize line endings
      buffer = buffer.replace(/\r\n/g, "\n");

      // Parse complete frames separated by blank lines (\n\n)
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || ""; // Keep incomplete tail frame

      for (const frame of parts) {
        const lines = frame.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            currentDataLines.push(line.slice(5).trimEnd());
          }
          // Ignore other SSE fields (id:, retry:) for v0
        }

        // Emit event after complete frame
        if (currentDataLines.length > 0) {
          try {
            const dataStr = currentDataLines.join("\n");
            const parsedData = JSON.parse(dataStr);
            onEvent({
              event: currentEvent,
              data: parsedData,
            });
          } catch (e) {
            console.error("Failed to parse SSE data:", currentDataLines, e);
          }
        }

        // Reset for next event (event defaults to "message")
        currentEvent = "message";
        currentDataLines = [];
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      // Don't throw on abort - user intentionally stopped
      if (error.name === "AbortError") {
        return;
      }
      onError?.(error);
    }
    throw error;
  }
}
