"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { contactsApi, type ContactInput } from "@/lib/api";
import { parseCsv, pick, type CsvRow } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, AlertTriangle } from "lucide-react";

interface ParsedContact extends ContactInput {
  _row: number;
}

/**
 * CSV contact import. Parses client-side, previews what will be created, then
 * creates rows one by one through the existing endpoint — whose unique index on
 * email/phone means duplicates come back as conflicts we can report rather than
 * silently double-inserting.
 */
export function ContactImportDialog({
  open,
  onOpenChange,
  companyId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  onImported: () => Promise<void> | void;
}) {
  const t = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedContact[] | null>(null);
  const [skippedRows, setSkippedRows] = useState(0);
  const [importing, setImporting] = useState(false);

  function reset() {
    setFileName(null);
    setParsed(null);
    setSkippedRows(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const text = await file.text();
      const { rows } = parseCsv(text);

      const mapped: ParsedContact[] = [];
      let skipped = 0;
      rows.forEach((row: CsvRow, i) => {
        const name = pick(row, "name", "nome", "contato", "full name");
        const email = pick(row, "email", "e-mail", "correo");
        const phone = pick(row, "phone", "telefone", "celular", "whatsapp", "telefono");
        // A contact with no identity at all is not importable.
        if (!name && !email && !phone) {
          skipped++;
          return;
        }
        mapped.push({
          _row: i + 2, // +2: 1-based, plus the header line
          name: name ?? null,
          email: email ?? null,
          phone: phone ?? null,
          notes: pick(row, "notes", "observacoes", "observações", "notas") ?? null,
          status: "New",
        });
      });

      setParsed(mapped);
      setSkippedRows(skipped);
    } catch {
      toast({ variant: "destructive", title: t("crm.import.parseError") });
      reset();
    }
  }

  async function runImport() {
    if (!parsed?.length) return;
    setImporting(true);
    let created = 0;
    let duplicates = 0;
    let failed = 0;

    for (const c of parsed) {
      const { _row, ...input } = c;
      void _row;
      try {
        await contactsApi.create(companyId, input);
        created++;
      } catch (err) {
        // 409 from the unique index = this identity already exists.
        const status = (err as { status?: number })?.status;
        if (status === 409) duplicates++;
        else failed++;
      }
    }

    setImporting(false);
    await onImported();
    onOpenChange(false);
    reset();

    if (failed > 0) {
      toast({
        variant: "destructive",
        title: t("crm.import.doneWithErrors", { created, duplicates, failed }),
      });
    } else {
      toast({ title: t("crm.import.done", { created, duplicates }) });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("crm.import.title")}</DialogTitle>
          <DialogDescription>{t("crm.import.description")}</DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-input p-10 transition-colors hover:border-primary/50">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">{t("crm.import.choose")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("crm.import.columnsHint")}</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{fileName}</Badge>
              <Badge variant="success">{t("crm.import.readyCount", { count: parsed.length })}</Badge>
              {skippedRows > 0 && (
                <Badge variant="outline" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t("crm.import.skippedCount", { count: skippedRows })}
                </Badge>
              )}
            </div>

            {parsed.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t("crm.contacts.name")}</TableHead>
                      <TableHead>{t("crm.contacts.email")}</TableHead>
                      <TableHead>{t("crm.contacts.phone")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.slice(0, 8).map((c) => (
                      <TableRow key={c._row}>
                        <TableCell className="font-medium">{c.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsed.length > 8 && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    {t("crm.import.andMore", { count: parsed.length - 8 })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {parsed && (
            <Button variant="outline" onClick={reset} disabled={importing}>
              {t("crm.import.chooseAnother")}
            </Button>
          )}
          <Button onClick={runImport} disabled={!parsed?.length || importing}>
            {importing ? <LoadingSpinner size="sm" className="mr-2" /> : <Upload className="mr-1 h-4 w-4" />}
            {t("crm.import.action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
