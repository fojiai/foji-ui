"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  password: string;
}

const rules = [
  { key: "minLength" as const, test: (p: string) => p.length >= 8 },
  { key: "uppercase" as const, test: (p: string) => /[A-Z]/.test(p) },
  { key: "lowercase" as const, test: (p: string) => /[a-z]/.test(p) },
  { key: "number" as const, test: (p: string) => /[0-9]/.test(p) },
];

export function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const t = useTranslations("auth.passwordRequirements");

  if (!password) return null;

  return (
    <ul className="mt-2 space-y-1">
      {rules.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.key}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              passed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}
          >
            {passed ? (
              <Check className="h-3 w-3" />
            ) : (
              <X className="h-3 w-3" />
            )}
            {t(rule.key)}
          </li>
        );
      })}
    </ul>
  );
}
