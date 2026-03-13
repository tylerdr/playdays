import { SiteShell } from "@/components/site-shell";
import { DiscoverBoard } from "@/components/discover-board";
import { getProfileFromSupabase } from "@/lib/supabase/storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DiscoverPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const initialProfile =
    supabase && user ? await getProfileFromSupabase(supabase, user.id, user.email ?? null) : null;

  return (
    <SiteShell>
      <DiscoverBoard initialProfile={initialProfile} />
    </SiteShell>
  );
}
