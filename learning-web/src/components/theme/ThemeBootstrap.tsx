"use client";

import { useEffect } from "react";
import { getSettings } from "@/lib/learningApi";

const STORAGE_KEY = "learningweb.theme";

function applyTheme(theme: string | null | undefined) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  try {
    localStorage.setItem(STORAGE_KEY, nextTheme);
  } catch {
    // optional cache only
  }
}

export function setLearningWebTheme(theme: string) {
  applyTheme(theme);
}

export function ThemeBootstrap() {
  useEffect(() => {
    try {
      applyTheme(localStorage.getItem(STORAGE_KEY));
    } catch {
      applyTheme("light");
    }

    void getSettings()
      .then((result) => applyTheme(result.settings.theme))
      .catch(() => {
        // Keep cached/default theme if backend is unavailable.
      });
  }, []);

  return null;
}
