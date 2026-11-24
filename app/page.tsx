import { WorkspaceView } from "@/components/workspace";
import { parseDemoState } from "@/lib/demo-state";
import { scheduleView } from "@/lib/schedule-view";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ state?: string | string[] }> }) {
  const privateMode = process.env.CLEARWEEK_MODE === "private";
  // The switch only exists in the open demo; signed-in mode always shows the real workspace.
  const demoState = privateMode ? undefined : parseDemoState((await searchParams).state);
  const view = scheduleView();
  return <WorkspaceView view={demoState === "empty" ? { ...view, conflict: null } : view} privateMode={privateMode} demoState={demoState}
    supabaseUrl={privateMode ? process.env.SUPABASE_URL : undefined}
    publishableKey={privateMode ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined} />;
}
