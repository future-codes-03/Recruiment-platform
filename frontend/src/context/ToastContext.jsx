import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);
let idCounter = 0;

const TONE_CLASSES = {
  success: "bg-ink text-white",
  error: "bg-danger text-white",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, { tone = "success", duration = 3000 } = {}) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  function dismiss(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            className={`${TONE_CLASSES[t.tone] || TONE_CLASSES.success} px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg cursor-pointer max-w-xs pointer-events-auto`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}