import { WorkspaceView } from "@/components/workspace";
import { scheduleView } from "@/lib/schedule-view";

export const dynamic = "force-dynamic";

export default function Home() {
  const privateMode = process.env.CLEARWEEK_MODE === "private";
  return <WorkspaceView view={scheduleView()} privateMode={privateMode}
    supabaseUrl={privateMode ? process.env.SUPABASE_URL : undefined}
    publishableKey={privateMode ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined} />;
}
