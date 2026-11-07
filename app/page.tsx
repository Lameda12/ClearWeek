import { WorkspaceView } from "@/components/workspace";

export const dynamic = "force-dynamic";

export default function Home() {
  const privateMode = process.env.CLEARWEEK_MODE === "private";
  return <WorkspaceView privateMode={privateMode}
    supabaseUrl={privateMode ? process.env.SUPABASE_URL : undefined}
    publishableKey={privateMode ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined} />;
}
