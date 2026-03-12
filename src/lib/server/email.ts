import { Resend } from "resend";
import type { DailyPlan, FamilyProfile } from "@/lib/schemas";
import { buildDailyPlan } from "@/lib/server/plan";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDigest(profile: FamilyProfile, plan: DailyPlan) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin:0;background:#f8f5ed;font-family:Arial,sans-serif;color:#253127;">
        <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
          <div style="background:#ffffff;border-radius:28px;padding:28px;border:1px solid rgba(80,102,84,0.12);box-shadow:0 24px 60px rgba(61,73,53,0.08);">
            <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7c8b78;">PlayDays</p>
            <h1 style="margin:0;font-size:34px;line-height:1.02;color:#243528;">${escapeHtml(plan.headline)}</h1>
            <p style="margin:12px 0 0;font-size:16px;line-height:1.7;color:#4b594c;">${escapeHtml(plan.encouragement)}</p>

            <div style="margin-top:22px;border-radius:22px;background:#eef4ec;padding:18px;">
              <strong style="display:block;font-size:14px;color:#2f4733;">Weather for ${escapeHtml(plan.weather.locationLabel)}</strong>
              <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#415042;">
                ${escapeHtml(plan.weather.summary)}. High ${plan.weather.high}F, low ${plan.weather.low}F, rain chance ${plan.weather.precipitationChance}%.
                ${escapeHtml(plan.weather.recommendation)}
              </p>
            </div>

            <div style="margin-top:28px;display:grid;gap:16px;">
              ${plan.activities
                .map(
                  (activity) => `
                    <section style="border:1px solid rgba(80,102,84,0.12);border-radius:22px;padding:18px;background:#fffdf8;">
                      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                        <div>
                          <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7c8b78;">${escapeHtml(activity.slot)}</p>
                          <h2 style="margin:8px 0 0;font-size:24px;color:#263629;">${escapeHtml(activity.emoji)} ${escapeHtml(activity.name)}</h2>
                        </div>
                        <div style="font-size:13px;color:#667466;">${escapeHtml(activity.duration)}</div>
                      </div>
                      <p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#455446;">${escapeHtml(activity.summary)}</p>
                      <p style="margin:10px 0 0;font-size:14px;line-height:1.7;color:#5b695b;">Materials: ${escapeHtml(activity.materials.join(", ") || "Minimal materials")}</p>
                      <ol style="margin:12px 0 0;padding-left:18px;color:#344334;line-height:1.7;">
                        ${activity.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
                      </ol>
                    </section>
                  `,
                )
                .join("")}
            </div>

            <div style="margin-top:28px;display:grid;gap:12px;">
              <h3 style="margin:0;font-size:20px;color:#263629;">Nearby picks</h3>
              ${plan.discovery
                .slice(0, 3)
                .map(
                  (place) => `
                    <div style="border:1px solid rgba(80,102,84,0.12);border-radius:18px;padding:14px;background:#ffffff;">
                      <strong style="display:block;color:#263629;">${escapeHtml(place.name)}</strong>
                      <span style="display:block;margin-top:4px;font-size:14px;color:#5e6c5f;">${escapeHtml(place.category)} · ${place.distanceMiles.toFixed(1)} mi</span>
                      <span style="display:block;margin-top:6px;font-size:14px;color:#465546;">${escapeHtml(place.address || place.hours)}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>

            <div style="margin-top:28px;border-top:1px solid rgba(80,102,84,0.12);padding-top:18px;font-size:13px;color:#6b786b;line-height:1.7;">
              Sent for ${escapeHtml(profile.parentName)}. To change digest settings, visit ${escapeHtml((process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/profile")}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendDailyDigest(profile: FamilyProfile, recipientEmail: string) {
  const built = await buildDailyPlan({ profile, history: [] });
  if (!('plan' in built) || !built.plan) {
    throw new Error('Could not build daily plan for digest.');
  }

  const plan = built.plan;
  const html = renderDigest(profile, plan);
  const subject = `PlayDays for ${profile.parentName || "today"} · ${plan.activities[0]?.name ?? "Your plan"}`;

  if (!process.env.RESEND_API_KEY) {
    return {
      mode: "preview" as const,
      subject,
      html,
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "PlayDays <onboarding@resend.dev>",
    to: recipientEmail,
    subject,
    html,
  });

  return {
    mode: "sent" as const,
    subject,
    html,
    result,
  };
}
