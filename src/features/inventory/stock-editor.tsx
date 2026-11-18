"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/shared";
export function StockEditor({
  remaining,
  threshold,
}: {
  remaining: number | null;
  threshold: number;
}) {
  const t = useTranslations("inventory");
  const [kind, setKind] = useState(remaining === null || remaining < 0 ? "adjust" : "in");
  return (
    <>
      <Field label={t("movement")}>
        <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {(remaining === null ? ["adjust"] : ["in", "out", "adjust"]).map((value) => (
            <option key={value} value={value}>
              {t(`kinds.${value}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={kind === "adjust" ? t("target") : t("quantity")}
        help={kind === "adjust" ? t("adjustHelp") : t("quantityHelp")}
      >
        <Input
          key={kind}
          name="quantity"
          type="number"
          min={kind === "adjust" ? 0 : 1}
          max={999999}
          step={1}
          required
        />
      </Field>
      <Field label={t("threshold")}>
        <Input
          name="threshold"
          type="number"
          min={0}
          max={999999}
          step={1}
          defaultValue={threshold}
          required
        />
      </Field>
      <Field label={t("reason")}>
        <Input name="reason" minLength={2} maxLength={120} required />
      </Field>
    </>
  );
}
