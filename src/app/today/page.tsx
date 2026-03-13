import { SiteShell } from "@/components/site-shell";
import { TodayBoard } from "@/components/today-board";
import {
  getHistoryFromSupabase,
  getPinnedPlaceFromSupabase,
  getStoredFamilyProfile,
} from "@/lib/supabase/storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function TodayPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const storedProfile =
    supabase && user ? await getStoredFamilyProfile(supabase, user.id, user.email ?? null) : null;
  const [initialHistory, initialPinnedPlace] =
    supabase && storedProfile
      ? await Promise.all([
          getHistoryFromSupabase(supabase, storedProfile.id),
          getPinnedPlaceFromSupabase(supabase, storedProfile.id),
        ])
      : [[], null];

  return (
    <SiteShell>
      <TodayBoard
        initialProfile={storedProfile?.profile ?? null}
        initialHistory={initialHistory}
        initialPinnedPlace={initialPinnedPlace}
      />
    </SiteShell>
  );
}
