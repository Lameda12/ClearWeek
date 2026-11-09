import { WorkspaceView } from "@/components/workspace";
import { extractionLimits, extractionMode } from "@/lib/extraction/config";

export const dynamic = "force-dynamic";

export default function Home() {
  const privateMode = process.env.CLEARWEEK_MODE === "private";
  const mode = extractionMode();
  return <WorkspaceView privateMode={privateMode}
    extraction={mode === "off" ? undefined : { mode, maxChars: extractionLimits().maxChars }}
    supabaseUrl={privateMode ? process.env.SUPABASE_URL : undefined}
    publishableKey={privateMode ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined} />;
}
