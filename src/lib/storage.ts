import { useEffect, useState } from "react";

const PREFIX = "uwcp:v1:";

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}
