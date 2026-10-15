import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const MESSAGES: Record<string, string> = {
  access_denied: "You declined access on SnapTrade, so nothing was shared. You can try again anytime.",
  session_expired: "Your session expired. Please sign in again.",
  state_mismatch: "Sign-in expired or was started in another tab. Please try again.",
  sign_in_failed: "Something went wrong finishing sign-in. Please try again.",
  incomplete_token_response: "SnapTrade didn't return everything we need. Please try again.",
  revoke_failed: "You're signed out here, but SnapTrade didn't confirm the disconnect. You can remove access in your SnapTrade Dashboard.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; disconnected?: string }>;
}) {
  if (await getSession()) redirect("/dashboard");
  const { error, disconnected } = await searchParams;

  return (
    <>
      <h1>ETF Look-Through</h1>
      <p className="muted">
        Your brokerage app shows a few ETFs. This shows the companies inside them, and how much
        of your money really sits in each one.
      </p>

      {disconnected && <div className="card">Disconnected. Your SnapTrade access was revoked.</div>}
      {error && (
        <div className="card error">{MESSAGES[error] ?? "Sign-in didn't complete. Please try again."}</div>
      )}

      <div className="card">
        <h2>Connect your accounts</h2>
        <p className="muted">
          Read-only: this app can view your holdings but can never place trades. You can disconnect
          anytime.
        </p>
        <a className="button" href="/login">Sign in with SnapTrade</a>
      </div>
    </>
  );
}
