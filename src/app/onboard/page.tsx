import { SiteShell } from "@/components/site-shell";
import { ProfileForm } from "@/components/profile-form";

export default function OnboardPage() {
  return (
    <SiteShell>
      <ProfileForm mode="onboard" />
    </SiteShell>
  );
}
