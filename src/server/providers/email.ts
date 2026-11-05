import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/errors";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** Grava em arquivo local (ignorado pelo git), para não registrar tokens em logs. */
class FileEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const dir = path.join(process.cwd(), ".dev-mail");
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${message.subject.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    await writeFile(
      path.join(dir, name),
      `Para: ${message.to}\nAssunto: ${message.subject}\n\n${message.text}\n`,
    );
  }
}

/** Usado nos testes. */
export const memoryOutbox: EmailMessage[] = [];
class MemoryEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    memoryOutbox.push(message);
  }
}

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? "file";
  if (provider === "memory") return new MemoryEmailProvider();
  if (provider === "file" && process.env.NODE_ENV !== "production") return new FileEmailProvider();
  throw new AppError(
    "EMAIL_NOT_CONFIGURED",
    "O envio de e-mails não está configurado neste ambiente.",
    503,
  );
}
