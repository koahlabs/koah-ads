import "server-only";
import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

export const signInEnabled = flag<boolean>({
  key: "sign-in-enabled",
  description: "Show sign-in and account navigation and allow new sign-ins.",
  adapter: vercelAdapter(),
  defaultValue: false,
});
