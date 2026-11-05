import { PageHeader } from "@/components/molecules/Feedback";
import { PrivacySection, ProfileSection, SecuritySection } from "@/components/organisms/Settings";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { centsToNumber } from "@/lib/money";
import { getAiProvider } from "@/server/providers/ai";
import { listSessions } from "@/server/services/auth";
import { listConsents } from "@/server/services/consent";

export const metadata = { title: "Configurações" };

const PURPOSE = {
  TERMS: "Termos de uso",
  PRIVACY_POLICY: "Política de privacidade",
  AI_PROCESSING: "Uso de IA",
} as const;

export default async function SettingsPage() {
  const { user, sessionId } = await requireUser();
  const [sessions, consents] = await Promise.all([listSessions(user.id, sessionId), listConsents(user.id)]);
  return (
    <>
      <PageHeader title="Configurações" description="Perfil, segurança e privacidade." />
      <ProfileSection
        name={user.name}
        email={user.email}
        emailVerified={user.emailVerifiedAt !== null}
        startDay={user.financialMonthStartDay}
        incomeCents={user.estimatedIncomeCents === null ? null : centsToNumber(user.estimatedIncomeCents)}
        reserveCents={user.minReserveCents === null ? null : centsToNumber(user.minReserveCents)}
      />
      <SecuritySection
        isDemo={user.isDemo}
        sessions={sessions.map((session) => ({
          id: session.id,
          userAgent: session.userAgent,
          lastSeen: formatDateTime(session.lastSeenAt),
          current: session.current,
        }))}
      />
      <PrivacySection
        aiEnabled={user.aiEnabled}
        aiAvailable={getAiProvider() !== null}
        isDemo={user.isDemo}
        consents={consents.map((consent) => ({
          id: consent.id,
          label: PURPOSE[consent.purpose],
          granted: formatDateTime(consent.grantedAt),
          revoked: consent.revokedAt ? formatDateTime(consent.revokedAt) : null,
        }))}
      />
    </>
  );
}
