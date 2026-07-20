import * as React from "react";
import { cn } from "@/lib/utils";
import { FIELD_CLASS } from "@/lib/design-system";

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full min-h-[44px] px-3 py-2 text-base md:text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
      FIELD_CLASS,
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
