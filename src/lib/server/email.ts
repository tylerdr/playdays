import { Resend } from "resend";
import type { FamilyProfile } from "@/lib/schemas";
import type { DailyDigestComposition } from "@/lib/server/agents/daily-digest";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderUpcomingItems(composition: DailyDigestComposition) {
  if (!composition.upcomingItems.length) {
    return `
      <div style="border:1px dashed rgba(80,102,84,0.18);border-radius:18px;padding:14px;background:#fffdf8;">
        <strong style="display:block;color:#263629;">No upcoming events saved yet</strong>
        <span style="display:block;margin-top:6px;font-size:14px;color:#5e6c5f;">PlayDays will include saved events, local discoveries, and your custom programs here when they are available.</span>
      </div>
    `;
  }

  return composition.upcomingItems
    .map(
      (item) => `
        <div style="border:1px solid rgba(80,102,84,0.12);border-radius:18px;padding:14px;background:#ffffff;">
          <strong style="display:block;color:#263629;">${escapeHtml(item.title)}</strong>
          <span style="display:block;margin-top:4px;font-size:14px;color:#5e6c5f;">${escapeHtml(item.timing)}${item.locationLabel ? ` · ${escapeHtml(item.locationLabel)}` : ""}</span>
          <span style="display:block;margin-top:6px;font-size:14px;color:#465546;">${escapeHtml(item.note)}</span>
          <span style="display:block;margin-top:8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#7c8b78;">${escapeHtml(item.sourceLabel)} · ${escapeHtml(item.verificationLabel)}</span>
          ${item.url ? `<a href="${escapeHtml(item.url)}" style="display:inline-block;margin-top:10px;font-size:13px;color:#2f4733;">Verify details</a>` : ""}
        </div>
      `,
    )
    .join("");
}

function renderWarnings(composition: DailyDigestComposition) {
  if (!composition.warnings.length) {
    return "";
  }

  return `
    <div style="margin-top:18px;border-radius:20px;background:#fff5dd;padding:16px;border:1px solid rgba(191,146,25,0.22);">
      <strong style="display:block;font-size:14px;color:#6b4b00;">Heads-up</strong>
      <ul style="margin:10px 0 0;padding-left:18px;color:#6b5a24;line-height:1.6;">
        ${composition.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderDigest(profile: FamilyProfile, composition: DailyDigestComposition) {
  const plan = composition.plan;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <body style="margin:0;background:#f8f5ed;font-family:Arial,sans-serif;color:#253127;">
        <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
          <div style="background:#ffffff;border-radius:28px;padding:28px;border:1px solid rgba(80,102,84,0.12);box-shadow:0 24px 60px rgba(61,73,53,0.08);">
            <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7c8b78;">PlayDays</p>
            <h1 style="margin:0;font-size:34px;line-height:1.02;color:#243528;">${escapeHtml(plan.headline)}</h1>
            <p style="margin:12px 0 0;font-size:16px;line-height:1.7;color:#4b594c;">${escapeHtml(plan.encouragement)}</p>

            <div style="margin-top:20px;border-radius:22px;background:#eef4ec;padding:18px;">
              <strong style="display:block;font-size:14px;color:#2f4733;">Preference-aware note for today</strong>
              <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#415042;">${escapeHtml(composition.note)}</p>
            </div>

            <div style="margin-top:18px;border-radius:22px;background:#f6f1df;padding:18px;">
              <strong style="display:block;font-size:14px;color:#5e5827;">Weather for ${escapeHtml(plan.weather.locationLabel)}</strong>
              <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#5c5a39;">${escapeHtml(composition.weatherNote)}</p>
            </div>

            <div style="margin-top:28px;display:grid;gap:16px;">
              <h2 style="margin:0;font-size:22px;color:#263629;">Today&apos;s plan</h2>
              ${plan.activities
                .map(
                  (activity) => `
                    <section style="border:1px solid rgba(80,102,84,0.12);border-radius:22px;padding:18px;background:#fffdf8;">
                      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                        <div>
                          <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7c8b78;">${escapeHtml(activity.slot)}</p>
                          <h3 style="margin:8px 0 0;font-size:24px;color:#263629;">${escapeHtml(activity.emoji)} ${escapeHtml(activity.name)}</h3>
                        </div>
                        <div style="font-size:13px;color:#667466;">${escapeHtml(activity.duration)}</div>
                      </div>
                      <p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#455446;">${escapeHtml(activity.summary)}</p>
                      <p style="margin:10px 0 0;font-size:14px;line-height:1.7;color:#5b695b;">Materials: ${escapeHtml(activity.materials.join(", ") || "Minimal materials")}</p>
                    </section>
                  `,
                )
                .join("")}
            </div>

            <div style="margin-top:28px;display:grid;gap:12px;">
              <h2 style="margin:0;font-size:22px;color:#263629;">Upcoming events and programs</h2>
              ${renderUpcomingItems(composition)}
            </div>

            ${renderWarnings(composition)}

            <div style="margin-top:28px;border-top:1px solid rgba(80,102,84,0.12);padding-top:18px;font-size:13px;color:#6b786b;line-height:1.7;">
              Sent for ${escapeHtml(profile.parentName)}. To change digest settings, visit ${escapeHtml((process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/profile")}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendDailyDigest(options: {
  profile: FamilyProfile;
  recipientEmail: string;
  composition: DailyDigestComposition;
}) {
  const html = renderDigest(options.profile, options.composition);

  if (!process.env.RESEND_API_KEY) {
    return {
      mode: "preview" as const,
      subject: options.composition.subject,
      html,
      previewText: options.composition.previewText,
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM ?? "PlayDays <onboarding@resend.dev>",
    to: options.recipientEmail,
    subject: options.composition.subject,
    html,
  });

  return {
    mode: "sent" as const,
    subject: options.composition.subject,
    html,
    previewText: options.composition.previewText,
    result,
  };
}
