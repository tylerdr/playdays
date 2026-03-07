import { SiteShell } from "@/components/site-shell";
import { ProfileForm } from "@/components/profile-form";

export default function SettingsPage() {
  return (
    <SiteShell>
      <ProfileForm mode="settings" />
    </SiteShell>
  );
}
