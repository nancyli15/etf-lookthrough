import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");
  return <Dashboard email={session.email} />;
}
