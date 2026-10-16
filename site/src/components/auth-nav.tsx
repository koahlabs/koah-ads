import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signInEnabled } from "@/lib/feature-flags";

export async function AuthNav() {
  if (!(await signInEnabled())) return null;
  const supabase = await createClient({ readOnly: true });
  let signedIn = false;
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getUser();
      signedIn = !error && !!data.user;
    } catch {
      /* Keep the navigation usable during provider downtime. */
    }
  }
  return (
    <Link className="header-sign-in" href={signedIn ? "/account" : "/sign-in"}>
      {signedIn ? "Account" : "Sign in"}
    </Link>
  );
}
