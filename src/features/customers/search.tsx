"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, Search } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Field } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CustomerSearch({ query }: { query: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(query);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requested = useRef(query);
  const composing = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    // An earlier search response must not replace text still being typed.
    if (query === requested.current) return;
    clearTimeout(timer.current);
    requested.current = query;
    setValue(query);
  }, [query]);

  function search(term: string) {
    clearTimeout(timer.current);
    const next = new URLSearchParams(params.toString());
    const q = term.trim();
    next.delete("page");
    if (q) next.set("q", q);
    else next.delete("q");
    if (next.toString() === params.toString()) return;
    requested.current = q;
    startTransition(() => {
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    });
  }

  function change(term: string) {
    setValue(term);
    clearTimeout(timer.current);
    if (!composing.current) timer.current = setTimeout(() => search(term), 300);
  }

  return (
    <form
      className="mb-5 flex flex-wrap items-end gap-3"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (!composing.current) search(value);
      }}
    >
      <Field label={t("common.search")}>
        <Input
          name="q"
          value={value}
          maxLength={100}
          placeholder={t("customers.search")}
          onChange={(event) => change(event.currentTarget.value)}
          onCompositionStart={() => {
            composing.current = true;
            clearTimeout(timer.current);
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            change(event.currentTarget.value);
          }}
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Search aria-hidden />
        )}
        {t(pending ? "common.loading" : "common.filter")}
      </Button>
    </form>
  );
}
