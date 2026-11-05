"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Callout } from "@/components/molecules/Feedback";
import { FormError, TextField } from "@/components/molecules/FormField";
import { useApiSubmit } from "@/lib/api/use-api-submit";

function read(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}

export function LoginForm({ demoEnabled }: { demoEnabled: boolean }) {
  const router = useRouter();
  const { submit, pending, fieldErrors, formError } = useApiSubmit();
  const demo = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await submit("POST", "/api/auth/login", read(event.currentTarget), {
      refresh: false,
    });
    if (result.ok) {
      router.push("/app");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField label="E-mail" name="email" type="email" autoComplete="email" required errors={fieldErrors.email} />
        <TextField
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          errors={fieldErrors.password}
        />
        <FormError message={formError} />
        <Button type="submit" loading={pending}>
          Entrar
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/recuperar-senha" className="font-semibold text-accent underline">
          Esqueci minha senha
        </Link>
        <Link href="/cadastro" className="font-semibold text-accent underline">
          Criar conta
        </Link>
      </div>
      {demoEnabled && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Button
            variant="secondary"
            loading={demo.pending}
            onClick={async () => {
              const result = await demo.submit("POST", "/api/auth/demo", undefined, { refresh: false });
              if (result.ok) {
                router.push("/app");
                router.refresh();
              }
            }}
          >
            Entrar na demonstração
          </Button>
          <p className="text-xs text-muted">Usa apenas dados fictícios, sem conexão bancária real.</p>
          <FormError message={demo.formError} />
        </div>
      )}
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { submit, pending, fieldErrors, formError } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = read(event.currentTarget);
    const result = await submit(
      "POST",
      "/api/auth/register",
      { ...data, acceptTerms: data.acceptTerms === "on" },
      { refresh: false },
    );
    if (result.ok) {
      router.push("/app/boas-vindas");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField label="Nome" name="name" autoComplete="name" required errors={fieldErrors.name} />
      <TextField label="E-mail" name="email" type="email" autoComplete="email" required errors={fieldErrors.email} />
      <TextField
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Use ao menos 10 caracteres."
        required
        errors={fieldErrors.password}
      />
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-5 shrink-0" />
          <span>
            Li e aceito os{" "}
            <Link href="/termos" className="font-semibold text-accent underline">
              termos de uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="font-semibold text-accent underline">
              política de privacidade
            </Link>
            .
          </span>
        </label>
        {fieldErrors.acceptTerms?.map((error) => (
          <p key={error} className="mt-1 text-xs font-medium text-negative">
            {error}
          </p>
        ))}
      </div>
      <FormError message={formError} />
      <Button type="submit" loading={pending}>
        Criar conta
      </Button>
      <p className="text-sm">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-accent underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const { submit, pending, fieldErrors, formError } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await submit("POST", "/api/auth/forgot-password", read(event.currentTarget), {
      refresh: false,
    });
    if (result.ok) setSent(true);
  }

  if (sent) {
    return (
      <Callout tone="positive">
        Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha. Ele vale por 1 hora.
      </Callout>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField label="E-mail" name="email" type="email" autoComplete="email" required errors={fieldErrors.email} />
      <FormError message={formError} />
      <Button type="submit" loading={pending}>
        Enviar link
      </Button>
      <Link href="/login" className="text-sm font-semibold text-accent underline">
        Voltar para o login
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const { submit, pending, fieldErrors, formError } = useApiSubmit();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await submit(
      "POST",
      "/api/auth/reset-password",
      { token, password: read(event.currentTarget).password },
      { refresh: false },
    );
    if (result.ok) setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <Callout tone="positive">Senha alterada. Por segurança, todas as sessões foram encerradas.</Callout>
        <Link href="/login" className="text-sm font-semibold text-accent underline">
          Entrar
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Use ao menos 10 caracteres."
        required
        errors={fieldErrors.password}
      />
      <FormError message={formError} />
      <Button type="submit" loading={pending}>
        Salvar nova senha
      </Button>
    </form>
  );
}

export function VerifyEmailAction({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const { submit, pending, formError } = useApiSubmit();
  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <Callout tone="positive">E-mail confirmado.</Callout>
        <Link href="/app" className="text-sm font-semibold text-accent underline">
          Ir para o app
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <FormError message={formError} />
      <Button
        loading={pending}
        onClick={async () => {
          const result = await submit("POST", "/api/auth/verify-email", { token }, { refresh: false });
          if (result.ok) setDone(true);
        }}
      >
        Confirmar meu e-mail
      </Button>
    </div>
  );
}
