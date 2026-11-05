"use client";

import { useRef, type FormEvent } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { ConfirmButton } from "@/components/molecules/ConfirmButton";
import { FormError, SelectField, TextField } from "@/components/molecules/FormField";
import { useApiSubmit } from "@/lib/api/use-api-submit";
import type { CategoryDTO } from "@/server/services/categories";

interface RuleDTO {
  id: string;
  matchType: "CONTAINS" | "STARTS_WITH" | "EQUALS";
  pattern: string;
  categoryName: string;
  priority: number;
}

const MATCH_LABEL = { CONTAINS: "contém", STARTS_WITH: "começa com", EQUALS: "é igual a" } as const;

export function CategoryManager({ categories, rules }: { categories: CategoryDTO[]; rules: RuleDTO[] }) {
  const newCategory = useApiSubmit();
  const newRule = useApiSubmit();
  const categoryForm = useRef<HTMLFormElement>(null);
  const ruleForm = useRef<HTMLFormElement>(null);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await newCategory.submit(
      "POST",
      "/api/categories",
      { name: data.get("name"), type: data.get("type") },
      { success: "Categoria criada." },
    );
    if (result.ok) categoryForm.current?.reset();
  }

  async function addRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await newRule.submit(
      "POST",
      "/api/category-rules",
      {
        matchType: data.get("matchType"),
        pattern: data.get("pattern"),
        categoryId: data.get("categoryId"),
        priority: Number(data.get("priority") || 100),
      },
      { success: "Regra criada." },
    );
    if (result.ok) ruleForm.current?.reset();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-4">
        <h2 className="font-bold">Categorias</h2>
        <form ref={categoryForm} onSubmit={addCategory} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-start" noValidate>
          <TextField label="Nova categoria" name="name" maxLength={40} errors={newCategory.fieldErrors.name} />
          <SelectField label="Tipo" name="type">
            <option value="EXPENSE">Despesa</option>
            <option value="INCOME">Receita</option>
          </SelectField>
          <Button type="submit" loading={newCategory.pending} className="sm:mt-6">
            Adicionar
          </Button>
        </form>
        <FormError message={newCategory.formError} />
        <ul className="divide-y divide-line">
          {categories.map((category) => (
            <li key={category.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{category.name}</span>
              <span className="flex items-center gap-2">
                <Badge tone={category.type === "INCOME" ? "info" : "neutral"}>
                  {category.type === "INCOME" ? "Receita" : "Despesa"}
                </Badge>
                {category.isDefault ? (
                  <Badge>Padrão</Badge>
                ) : (
                  <ConfirmButton
                    variant="ghost"
                    label="Excluir"
                    ariaLabel={`Excluir categoria ${category.name}`}
                    title="Excluir categoria"
                    description={`Os lançamentos de "${category.name}" ficarão sem categoria, e os orçamentos e regras dela serão removidos.`}
                    confirmLabel="Excluir"
                    url={`/api/categories/${category.id}`}
                    success="Categoria excluída."
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-bold">Regras de categorização</h2>
          <p className="text-sm text-muted">
            Sugerem a categoria pela descrição, com prioridade sobre a classificação automática. Você sempre pode trocar.
          </p>
        </div>
        <form ref={ruleForm} onSubmit={addRule} className="grid gap-3 sm:grid-cols-2" noValidate>
          <SelectField label="Quando a descrição" name="matchType">
            {Object.entries(MATCH_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField label="Texto" name="pattern" maxLength={80} errors={newRule.fieldErrors.pattern} />
          <SelectField label="Categoria" name="categoryId" errors={newRule.fieldErrors.categoryId}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.type === "INCOME" ? "receita" : "despesa"})
              </option>
            ))}
          </SelectField>
          <TextField
            label="Prioridade"
            name="priority"
            type="number"
            min={1}
            max={1000}
            defaultValue={100}
            hint="Menor número é avaliado primeiro."
            errors={newRule.fieldErrors.priority}
          />
          <div className="sm:col-span-2">
            <Button type="submit" loading={newRule.pending}>
              Adicionar regra
            </Button>
          </div>
        </form>
        <FormError message={newRule.formError} />
        {rules.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma regra cadastrada.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  {MATCH_LABEL[rule.matchType]} “{rule.pattern}” → <strong>{rule.categoryName}</strong>
                  <span className="text-muted"> · prioridade {rule.priority}</span>
                </span>
                <ConfirmButton
                  variant="ghost"
                  label="Excluir"
                  ariaLabel={`Excluir regra ${rule.pattern}`}
                  title="Excluir regra"
                  description="A regra deixa de sugerir categoria. Os lançamentos existentes não mudam."
                  confirmLabel="Excluir"
                  url={`/api/category-rules/${rule.id}`}
                  success="Regra excluída."
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
