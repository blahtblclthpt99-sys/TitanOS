import * as React from "react";
import { cn } from "@/lib/utils";
import { FIELD_CLASS } from "@/lib/design-system";

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[88px] w-full px-3 py-2.5 text-base md:text-sm",
      FIELD_CLASS,
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
