"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { readSetupStatus } from "@/app/account/actions";
import type { SetupStatus } from "@/lib/dashboard";

export function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function useSetupStatus(initial: SetupStatus, intervalMs: number) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    const next = await readSetupStatus().catch(() => null);
    if (next) return setStatus(next);
    // The session ended or the status is unreadable: let the page decide what to show.
    router.refresh();
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [check, intervalMs]);

  async function checkNow() {
    setChecking(true);
    await check();
    setChecking(false);
  }

  return { status, checking, checkNow };
}
