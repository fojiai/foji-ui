"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIAL_CODES, joinPhone, splitPhone } from "@/lib/phone";

export interface PhoneInputProps {
  /** Full E.164 value, e.g. "+5585981560609". */
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Phone field with the country code as its own selector, so people stop typing
 * (or forgetting) the "+55" prefix. Emits a combined E.164 string, so the API
 * contract is unchanged.
 */
export function PhoneInput({ value, onChange, placeholder, disabled, id }: PhoneInputProps) {
  const { dial, number } = useMemo(() => splitPhone(value), [value]);

  return (
    <div className="flex gap-2">
      <Select value={dial} onValueChange={(d) => onChange(joinPhone(d, number))} disabled={disabled}>
        <SelectTrigger className="w-[116px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIAL_CODES.map((c) => (
            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        inputMode="tel"
        autoComplete="tel-national"
        className="flex-1"
        placeholder={placeholder}
        disabled={disabled}
        value={number}
        onChange={(e) => onChange(joinPhone(dial, e.target.value))}
      />
    </div>
  );
}
