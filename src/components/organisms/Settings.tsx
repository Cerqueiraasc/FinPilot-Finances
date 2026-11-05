"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { ConfirmButton } from "@/components/molecules/ConfirmButton";
import { Callout } from "@/components/molecules/Feedback";
import { FormError, MoneyField, TextField } from "@/components/molecules/FormField";
import { Modal } from "@/components/molecules/Modal";
import { useToast } from "@/components/molecules/ToastProvider";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import { centsToInput, parseBRLToCents } from "@/lib/money";

function optionalCents(raw: FormDataEntryValue | null): number | null | "invalid" {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const cents = parseBRLToCents(text);
  return cents === null || cents < 0 ? "invalid" : cents;
}

export function ProfileSection({
  name,
  email,
  emailVerified,
  startDay,
  incomeCents,
  reserveCents,
}: {
  name: string;
  email: string;
  emailVerified: boolean;
  startDay: number;
  incomeCents: number | null;
  reserveCents: number | null;
}) {
  const { submit, pending, fieldErrors, formError, setFieldErrors } = useApiSubmit();
  const resend = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const estimatedIncomeCents = optionalCents(data.get("income"));
    const minReserveCents = optionalCents(data.get("reserve"));
    if (estimatedIncomeCents === "invalid" || minReserveCents === "invalid") {
      setFieldErrors({
        ...(estimatedIncomeCents === "invalid" ? { estimatedIncomeCents: ["Valor inválido"] } : {}),
        ...(minReserveCents === "invalid" ? { minReserveCents: ["Valor inválido"] } : {}),
      });
      return;
    }
    await submit(
      "PATCH",
      "/api/me",
      {
        name: data.get("name"),
        financialMonthStartDay: Number(data.get("startDay")),
        estimatedIncomeCents,
        minReserveCents,
      },
      { success: "Perfil atualizado." },
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-bold">Perfil e preferências</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="min-w-0 break-all">{email}</span>
        {emailVerified ? (
          <Badge tone="positive">Verificado</Badge>
        ) : (
          <>
            <Badge tone="warning">Não verificado</Badge>
            <Button
              size="sm"
              variant="ghost"
              loading={resend.pending}
              onClick={() =>
                resend.submit("POST", "/api/auth/resend-verification", undefined, {
                  success: "Enviamos um novo link de confirmação.",
                  refresh: false,
                })
              }
            >
              Reenviar link
            </Button>
          </>
        )}
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField label="Nome" name="name" defaultValue={name} maxLength={100} errors={fieldErrors.name} />
        <TextField
          label="Início do mês financeiro"
          name="startDay"
          type="number"
          min={1}
          max={28}
          defaultValue={startDay}
          hint="Dia de 1 a 28."
          errors={fieldErrors.financialMonthStartDay}
        />
        <MoneyField
          label="Renda estimada (opcional)"
          name="income"
          defaultValue={incomeCents === null ? "" : centsToInput(incomeCents)}
          errors={fieldErrors.estimatedIncomeCents}
        />
        <MoneyField
          label="Reserva mínima (opcional)"
          name="reserve"
          hint="Usada no simulador de compra."
          defaultValue={reserveCents === null ? "" : centsToInput(reserveCents)}
          errors={fieldErrors.minReserveCents}
        />
        <div className="sm:col-span-2">
          <FormError message={formError} />
          <Button type="submit" loading={pending} className="mt-2">
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function SecuritySection({
  isDemo,
  sessions,
}: {
  isDemo: boolean;
  sessions: { id: string; userAgent: string | null; lastSeen: string; current: boolean }[];
}) {
  const { submit, pending, fieldErrors, formError } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await submit(
      "POST",
      "/api/me/password",
      { currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") },
      { success: "Senha alterada. As outras sessões foram encerradas." },
    );
    if (result.ok) form.reset();
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-bold">Segurança</h2>
      {!isDemo && (
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <TextField
            label="Senha atual"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            errors={fieldErrors.currentPassword}
          />
          <TextField
            label="Nova senha"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            hint="Ao alterar, as outras sessões são encerradas."
            errors={fieldErrors.newPassword}
          />
          <div className="sm:col-span-2">
            <FormError message={formError} />
            <Button type="submit" loading={pending} className="mt-2">
              Alterar senha
            </Button>
          </div>
        </form>
      )}
      <div>
        <h3 className="text-sm font-bold">Sessões ativas</h3>
        <ul className="mt-2 divide-y divide-line">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{session.userAgent ?? "Navegador desconhecido"}</span>
                <span className="text-xs text-muted">Último uso: {session.lastSeen}</span>
              </span>
              {session.current ? (
                <Badge tone="positive">Esta sessão</Badge>
              ) : (
                <ConfirmButton
                  label="Encerrar"
                  title="Encerrar sessão"
                  description="O dispositivo precisará fazer login novamente."
                  confirmLabel="Encerrar"
                  url={`/api/me/sessions/${session.id}`}
                  success="Sessão encerrada."
                />
              )}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function PrivacySection({
  aiEnabled,
  aiAvailable,
  consents,
  isDemo,
}: {
  aiEnabled: boolean;
  aiAvailable: boolean;
  consents: { id: string; label: string; granted: string; revoked: string | null }[];
  isDemo: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const ai = useApiSubmit();
  const remove = useApiSubmit();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function exportData() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/privacy/export", { method: "POST" });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "finpilot-meus-dados.json";
      link.click();
      URL.revokeObjectURL(url);
      showToast("Exportação concluída.");
    } catch {
      setExportError("Não foi possível exportar agora. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await remove.submit(
      "POST",
      "/api/privacy/delete-request",
      { password: data.get("password"), confirmation: data.get("confirmation") },
      { refresh: false },
    );
    if (result.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <Card className="flex flex-col gap-5">
      <h2 className="font-bold">Privacidade e dados</h2>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Assistente com IA (opcional)</h3>
        <p className="text-sm text-muted">
          Se ativada, a IA recebe apenas números agregados do período, enviados a um provedor externo. Descrições, notas e nomes de contas não são enviados. Sem ela, o assistente continua funcionando com cálculos locais.
        </p>
        {!aiAvailable && (
          <Callout tone="info">A IA não está configurada neste ambiente, então o assistente usa apenas cálculos locais.</Callout>
        )}
        <FormError message={ai.formError} />
        <div>
          <Button
            variant="secondary"
            loading={ai.pending}
            onClick={() =>
              ai.submit(
                "POST",
                "/api/me/ai-preference",
                { enabled: !aiEnabled },
                { success: aiEnabled ? "IA desativada." : "IA ativada." },
              )
            }
          >
            {aiEnabled ? "Desativar IA e revogar consentimento" : "Ativar IA e dar consentimento"}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Consentimentos registrados</h3>
        <ul className="divide-y divide-line text-sm">
          {consents.map((consent) => (
            <li key={consent.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{consent.label}</span>
              <span className="text-xs text-muted">
                {consent.revoked ? `Revogado em ${consent.revoked}` : `Concedido em ${consent.granted}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Exportar meus dados</h3>
        <p className="text-sm text-muted">Baixe todos os seus dados em um arquivo JSON.</p>
        <FormError message={exportError} />
        <div>
          <Button variant="secondary" loading={exporting} onClick={exportData}>
            Exportar dados
          </Button>
        </div>
      </section>

      {!isDemo && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Excluir minha conta</h3>
          <p className="text-sm text-muted">Remove sua conta e todos os seus dados imediatamente. Não é possível desfazer.</p>
          <div>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              Excluir conta
            </Button>
          </div>
          <Modal open={deleting} title="Excluir conta definitivamente" onClose={() => setDeleting(false)}>
            <form onSubmit={onDelete} className="flex flex-col gap-4" noValidate>
              <p className="text-sm text-muted">Considere exportar seus dados antes. Esta ação não pode ser desfeita.</p>
              <TextField label="Sua senha" name="password" type="password" autoComplete="current-password" errors={remove.fieldErrors.password} />
              <TextField label='Digite "EXCLUIR" para confirmar' name="confirmation" autoComplete="off" errors={remove.fieldErrors.confirmation} />
              <FormError message={remove.formError} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setDeleting(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="danger" loading={remove.pending}>
                  Excluir definitivamente
                </Button>
              </div>
            </form>
          </Modal>
        </section>
      )}
    </Card>
  );
}
