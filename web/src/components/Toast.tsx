"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface ToastProps {
  message: string | null;
  type?: "error" | "info";
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = "error",
  onClose,
  duration = 5000,
}: ToastProps) {
  useEffect(() => {
    if (message && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 right-4 z-50 max-w-md"
        >
          <div
            className={`p-4 rounded-lg shadow-lg border ${
              type === "error"
                ? "bg-red-900/90 border-red-700 text-red-100"
                : "bg-blue-900/90 border-blue-700 text-blue-100"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{message}</p>
              <button
                onClick={onClose}
                className="text-current opacity-70 hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
