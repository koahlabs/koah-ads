"use client";

import { useEffect } from "react";

// The development preview can inspect both existing themes without saving a
// preference or changing the theme when the user leaves the preview route.
export function DashboardPreviewTheme({ theme }: { theme?: "light" | "dark" }) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = theme;
    return () => {
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
    };
  }, [theme]);
  return null;
}
