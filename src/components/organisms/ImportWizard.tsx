"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button, buttonClasses } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { Money } from "@/components/atoms/Money";
import { Callout } from "@/components/molecules/Feedback";
import { FormError, SelectField, TextField } from "@/components/molecules/FormField";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import { formatDate } from "@/lib/dates";
import type { AccountOption } from "./TransactionForms";

type DateFormat = "DD/MM/YYYY" | "YYYY-MM-DD" | "MM/DD/YYYY";

interface Mapping {
  date: number;
  description: number;
  amount: number;
  externalId: number | null;
}

interface PreviewRow {
  rowIndex: number;
  date: string | null;
  description: string;
  signedAmountCents: number | null;
  errors: string[];
  duplicate: "EXISTING" | "IN_FILE" | null;
}

interface PreviewResult {
  headers: string[];
  totalRows: number;
  mapping: Mapping;
  alreadyImported: boolean;
  mappingComplete: boolean;
  rows: PreviewRow[];
}

interface CommitResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
}

const MAX_PREVIEW_ROWS = 200;

export function ImportWizard({ accounts }: { accounts: AccountOption[] }) {
  const preview = useApiSubmit();
  const commit = useApiSubmit();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [done, setDone] = useState<CommitResult | null>(null);

  async function requestPreview(next: {
    text?: string;
    name?: string;
    mapping?: Mapping | null;
    dateFormat?: DateFormat;
  }) {
    const text = next.text ?? file?.text;
    const filename = next.name ?? file?.name;
    if (!text || !filename) return;
    const nextMapping = next.mapping === undefined ? mapping : next.mapping;
    const response = await preview.submit<PreviewResult>(
      "POST",
      "/api/imports/preview",
      {
        accountId,
        filename,
        csvText: text,
        dateFormat: next.dateFormat ?? dateFormat,
        ...(nextMapping ? { mapping: nextMapping } : {}),
      },
      { refresh: false },
    );
    if (!response.ok) return;
    setResult(response.data);
    setMapping(response.data.mapping);
    // Por padrão entra o que é novo; duplicatas só com escolha explícita.
    setIncluded(
      Object.fromEntries(
        response.data.rows.map((row) => [row.rowIndex, row.errors.length === 0 && row.duplicate === null]),
      ),
    );
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const text = await selected.text();
    setFile({ name: selected.name, text });
    setDone(null);
    setMapping(null);
    await requestPreview({ text, name: selected.name, mapping: null });
  }

  const counts = useMemo(() => {
    const rows = result?.rows ?? [];
    return {
      valid: rows.filter((row) => row.errors.length === 0).length,
      duplicates: rows.filter((row) => row.duplicate).length,
      errors: rows.filter((row) => row.errors.length > 0).length,
      selected: rows.filter((row) => included[row.rowIndex]).length,
    };
  }, [result, included]);

  async function confirmImport() {
    if (!result || !file || !mapping) return;
    const response = await commit.submit<CommitResult>(
      "POST",
      "/api/imports/commit",
      {
        accountId,
        filename: file.name,
        csvText: file.text,
        dateFormat,
        mapping,
        decisions: result.rows
          .filter((row) => row.errors.length === 0)
          .map((row) => ({ rowIndex: row.rowIndex, include: Boolean(included[row.rowIndex]) })),
      },
      { success: "Importação concluída." },
    );
    if (response.ok) {
      setDone(response.data);
      setResult(null);
      setFile(null);
    }
  }

  if (done) {
    return (
      <Card className="flex flex-col gap-3">
        <Callout tone="positive">
          {done.imported} lançamento(s) importado(s). {done.skipped} ignorado(s), {done.errors} com erro.
        </Callout>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/transacoes" className={buttonClasses("primary")}>
            Ver transações
          </Link>
          <Button variant="secondary" onClick={() => setDone(null)}>
            Importar outro arquivo
          </Button>
        </div>
      </Card>
    );
  }

  const mappingField = (label: string, key: keyof Mapping, optional = false) => (
    <SelectField
      label={label}
      value={mapping?.[key] ?? ""}
      onChange={(event) => {
        const value = event.target.value;
        const next = { ...mapping!, [key]: value === "" ? (optional ? null : -1) : Number(value) };
        setMapping(next);
        if (next.date >= 0 && next.description >= 0 && next.amount >= 0) {
          void requestPreview({ mapping: next });
        } else {
          setResult((current) => (current ? { ...current, rows: [], mappingComplete: false } : current));
        }
      }}
    >
      <option value="">{optional ? "Nenhuma" : "Selecione"}</option>
      {result?.headers.map((header, index) => (
        <option key={index} value={index}>
          {header || `Coluna ${index + 1}`}
        </option>
      ))}
    </SelectField>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Conta de destino"
          value={accountId}
          disabled={Boolean(file)}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Arquivo CSV"
          type="file"
          accept=".csv,text/csv"
          hint="Até 2 MB. Valores negativos viram despesa; positivos, receita."
          onChange={onFile}
          className="py-2"
        />
      </Card>

      <FormError message={preview.formError} />
      {preview.pending && <p role="status" className="text-sm text-muted">Lendo o arquivo…</p>}

      {result && (
        <>
          {result.alreadyImported && (
            <Callout tone="warning">
              Este mesmo arquivo já foi importado nesta conta. Revise as duplicatas antes de confirmar.
            </Callout>
          )}
          <Card className="flex flex-col gap-4">
            <h2 className="font-bold">Mapeamento de colunas</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {mappingField("Data", "date")}
              {mappingField("Descrição", "description")}
              {mappingField("Valor", "amount")}
              {mappingField("Identificador", "externalId", true)}
              <SelectField
                label="Formato da data"
                value={dateFormat}
                onChange={(event) => {
                  const next = event.target.value as DateFormat;
                  setDateFormat(next);
                  void requestPreview({ dateFormat: next });
                }}
              >
                <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                <option value="YYYY-MM-DD">AAAA-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/AAAA</option>
              </SelectField>
            </div>
          </Card>
          {result.mappingComplete ? (
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">Prévia: nada foi gravado ainda</h2>
                <p className="flex flex-wrap gap-1">
                  <Badge tone="positive">{counts.selected} selecionada(s)</Badge>
                  <Badge tone="warning">{counts.duplicates} duplicada(s)</Badge>
                  <Badge tone="negative">{counts.errors} com erro</Badge>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Prévia das linhas do arquivo</caption>
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th scope="col" className="py-2 pr-2 font-semibold">Importar</th>
                      <th scope="col" className="py-2 pr-2 font-semibold">Data</th>
                      <th scope="col" className="py-2 pr-2 font-semibold">Descrição</th>
                      <th scope="col" className="py-2 pr-2 text-right font-semibold">Valor</th>
                      <th scope="col" className="py-2 font-semibold">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, MAX_PREVIEW_ROWS).map((row) => (
                      <tr key={row.rowIndex} className="border-b border-line last:border-0">
                        <td className="py-2 pr-2">
                          <input
                            type="checkbox"
                            className="size-5"
                            aria-label={`Importar linha ${row.rowIndex + 1}`}
                            disabled={row.errors.length > 0}
                            checked={Boolean(included[row.rowIndex])}
                            onChange={(event) =>
                              setIncluded((current) => ({ ...current, [row.rowIndex]: event.target.checked }))
                            }
                          />
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">{row.date ? formatDate(row.date) : "—"}</td>
                        <td className="max-w-64 truncate py-2 pr-2">{row.description || "—"}</td>
                        <td className="py-2 pr-2 text-right">
                          {row.signedAmountCents !== null ? <Money cents={row.signedAmountCents} signed /> : "—"}
                        </td>
                        <td className="py-2">
                          {row.errors.length > 0 ? (
                            <Badge tone="negative">{row.errors[0]}</Badge>
                          ) : row.duplicate === "EXISTING" ? (
                            <Badge tone="warning">Já registrada</Badge>
                          ) : row.duplicate === "IN_FILE" ? (
                            <Badge tone="warning">Repetida no arquivo</Badge>
                          ) : (
                            <Badge tone="positive">Nova</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.rows.length > MAX_PREVIEW_ROWS && (
                <p className="text-sm text-muted">
                  Mostrando {MAX_PREVIEW_ROWS} de {result.rows.length} linhas. As demais seguem a seleção
                  padrão: novas entram e duplicatas ficam de fora.
                </p>
              )}
              <FormError message={commit.formError} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button loading={commit.pending} disabled={counts.selected === 0} onClick={confirmImport}>
                  Confirmar importação
                </Button>
              </div>
            </Card>
          ) : (
            <Callout tone="info">Selecione as colunas de data, descrição e valor para ver a prévia.</Callout>
          )}
        </>
      )}
    </div>
  );
}
