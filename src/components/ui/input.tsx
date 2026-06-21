import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-sm border-2 border-transparent bg-[#151c22] px-3 py-1 text-sm text-[var(--text-primary)]",
        "placeholder:text-[var(--text-muted)]",
        "focus:border-[var(--border-focus)] focus:bg-[#181e23] focus:outline-none",
        "disabled:bg-[var(--bg-surface)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed",
        "transition-[border-color,background] duration-150",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
