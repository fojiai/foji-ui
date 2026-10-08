"use client";

import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** "Ver tour" — replays the current page's guided tour. */
export function TourButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("tour");
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="text-muted-foreground">
      <HelpCircle className="mr-1 h-4 w-4" />
      {t("replay")}
    </Button>
  );
}
