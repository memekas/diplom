import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { getProfile } from "@/lib/services/profile";
import { skillLevels, skillLevelLabels } from "@/lib/validation/auth";
import { courtSides, courtSideLabels } from "@/lib/validation/profile";
import { ProfileForm } from "./profile-form";
import "./profile.css";

// Initials for the player-pass avatar: first letters of the first two words.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default async function ProfilePage() {
  // Security boundary first — identity from the signed session cookie only.
  // The guard throws "Unauthorized" when anonymous; convert to a redirect for UX.
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    // Only the guard's auth contract bounces to /login. Operational failures
    // (DB/session errors) must surface to the error boundary, not masquerade
    // as a logout.
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "Forbidden")) {
      redirect("/login");
    }
    throw e;
  }

  const profile = await getProfile(prisma, user.id);

  const skillLabel =
    profile.skillLevel && (skillLevels as readonly string[]).includes(profile.skillLevel)
      ? skillLevelLabels[profile.skillLevel as (typeof skillLevels)[number]]
      : "—";
  const sideLabel = (courtSides as readonly string[]).includes(profile.courtSide)
    ? courtSideLabels[profile.courtSide as (typeof courtSides)[number]]
    : profile.courtSide;

  return (
    <main className="cq mx-auto w-full max-w-xl flex-1 px-5 py-7">
      {/* player-pass identity card */}
      <header className="card card-pad idcard">
        <div className="id-top">
          <div className="id-avatar">{initials(profile.name)}</div>
          <div className="id-name">
            <span className="eyebrow">Личный кабинет</span>
            <h1>{profile.name}</h1>
            <span className="id-handle mono">@{profile.nickname}</span>
          </div>
        </div>

        <div className="id-chips">
          <span className="id-chip accent">
            <span className="ck">Уровень</span> <b>{skillLabel}</b>
          </span>
          <span className="id-chip">
            <span className="ck">Сторона</span> <b>{sideLabel}</b>
          </span>
        </div>

        <div className="id-contact meta">
          <div className="meta-row">
            <span className="meta-key">Email</span>
            <span className="meta-val mono">
              {profile.email}
              <span className="ro-tag">логин</span>
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-key">Телефон</span>
            <span className="meta-val mono">
              {profile.phone || "—"}
              <span className="ro-tag">скрыт от соперников</span>
            </span>
          </div>
        </div>
      </header>

      <hr className="net-rule" style={{ margin: "24px 0" }} />

      <ProfileForm
        initial={{
          name: profile.name,
          email: profile.email,
          nickname: profile.nickname,
          courtSide: profile.courtSide,
          phone: profile.phone ?? "",
          skillLevel: profile.skillLevel ?? "",
          // Date input wants yyyy-MM-dd; slice the ISO string.
          birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : "",
        }}
      />
    </main>
  );
}
