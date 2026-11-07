import { redirect } from "next/navigation";
import { getSession } from "@/lib/snaptrade/session/session";
import Dashboard from "./Dashboard";

// Run on every request, never from a cache: every user's data is different.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");
  return <Dashboard email={session.email} />;
}
