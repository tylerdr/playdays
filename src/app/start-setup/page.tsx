import { SiteShell } from "@/components/site-shell";
import { ProfileForm } from "@/components/profile-form";

export default function StartSetupPage() {
  return (
    <SiteShell variant="setup">
      <ProfileForm mode="onboard" />
    </SiteShell>
  );
}
