import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

function ToastIcon({ variant }) {
  if (variant === "destructive") {
    return <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive-foreground" aria-hidden="true" />;
  }
  if (variant === "success") {
    return <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success success-pop" aria-hidden="true" />;
  }
  return <Info className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />;
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, open, variant, ...props }) {
        if (open === false) return null;
        return (
          <Toast
            key={id}
            variant={variant}
            {...props}
            onClick={() => dismiss(id)}
            role="status"
            aria-live={variant === "destructive" ? "assertive" : "polite"}
            className="toast-enter"
          >
            <div className="flex items-start gap-3 pr-2">
              <ToastIcon variant={variant} />
              <div className="grid min-w-0 flex-1 gap-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose
              onClick={(event) => {
                event.stopPropagation();
                dismiss(id);
              }}
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
