import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

interface LoadingSpinnerProps {
  size?: Size;
  className?: string;
  label?: string;
}

export function LoadingSpinner({ size = "md", className, label }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizes[size])} />
      {label && <span className="text-muted-foreground text-sm">{label}</span>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[400px] w-full items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
