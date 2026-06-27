import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shared/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // اطمینان از وجود سازمان (membership)
  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("is_active", true)
    .limit(1);

  if (!memberships || memberships.length === 0) {
    redirect("/setup");
  }

  return <AppShell>{children}</AppShell>;
}
