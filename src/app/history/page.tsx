import { SiteShell } from "@/components/site-shell";
import { HistoryBoard } from "@/components/history-board";
import {
  getHistoryFromSupabase,
  getSavedItemsFromSupabase,
  getStoredFamilyProfile,
} from "@/lib/supabase/storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const storedProfile =
    supabase && user ? await getStoredFamilyProfile(supabase, user.id, user.email ?? null) : null;
  const [initialHistory, initialSaved] =
    supabase && storedProfile
      ? await Promise.all([
          getHistoryFromSupabase(supabase, storedProfile.id),
          getSavedItemsFromSupabase(supabase, storedProfile.id),
        ])
      : [[], []];

  return (
    <SiteShell>
      <HistoryBoard initialHistory={initialHistory} initialSaved={initialSaved} />
    </SiteShell>
  );
}
