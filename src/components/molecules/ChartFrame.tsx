"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/atoms/Card";
import { Button } from "@/components/atoms/Button";

/** Todo gráfico tem alternativa textual: um resumo e uma tabela com os mesmos dados. */
export function ChartFrame({
  title,
  summary,
  table,
  children,
}: {
  title: string;
  summary: string;
  table: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-bold">{title}</h2>
          <p className="text-sm text-muted">{summary}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-pressed={showTable}
          onClick={() => setShowTable((value) => !value)}
        >
          {showTable ? "Ver gráfico" : "Ver tabela"}
        </Button>
      </div>
      {showTable ? (
        <div className="overflow-x-auto">{table}</div>
      ) : (
        <div role="img" aria-label={`${title}. ${summary}`}>
          {children}
        </div>
      )}
    </Card>
  );
}

export function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line text-muted">
          {headers.map((header) => (
            <th key={header} scope="col" className="py-2 pr-3 font-semibold">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-line last:border-0">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="py-2 pr-3">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
