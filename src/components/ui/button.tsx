import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* The primary action is the hot one: an ember fill lit from above, with
           the shadow tinted toward the flame rather than neutral grey. */
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.22),0_1px_2px_0_oklch(0.35_0.14_35/0.35),0_6px_16px_-8px_oklch(0.55_0.20_32/0.55)] hover:brightness-[1.07]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_oklch(1_0_0/0.18)] hover:brightness-[1.08]",
        outline:
          "border border-input bg-card shadow-[0_1px_2px_-1px_oklch(0.3_0.05_45/0.12)] hover:bg-accent hover:text-accent-foreground hover:border-primary/30",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        /* For actions sitting on the anvil band, where the ground is already dark. */
        iron: "bg-white/10 text-iron-foreground backdrop-blur-sm border border-white/15 hover:bg-white/[0.17]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
