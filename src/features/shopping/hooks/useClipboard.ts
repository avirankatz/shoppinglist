import { useCallback, useState } from "react";

const copyWithFallback = (value: string): boolean => {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
};

export function useClipboard() {
  const [copied, setCopied] = useState("");

  const copyToClipboard = useCallback(async (value: string, key: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!copyWithFallback(value)) return;
    } catch {
      if (!copyWithFallback(value)) return;
    }
    setCopied(key);
    setTimeout(() => setCopied(""), 1400);
  }, []);

  return { copied, copyToClipboard };
}
