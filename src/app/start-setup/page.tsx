import { SiteShell } from "@/components/site-shell";
import { ProfileForm } from "@/components/profile-form";
import { getProfileFromSupabase } from "@/lib/supabase/storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function StartSetupPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const initialProfile =
    supabase && user ? await getProfileFromSupabase(supabase, user.id, user.email ?? null) : null;

  return (
    <SiteShell variant="setup">
      <ProfileForm
        mode="onboard"
        initialProfile={initialProfile}
        authUserEmail={user?.email ?? null}
      />
    </SiteShell>
  );
}
