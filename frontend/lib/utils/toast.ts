import { toast as sonnerToast, ExternalToast } from "sonner";

/**
 * Custom toast utilities with brand styling consistent with Alert components
 * Colors and styling match the existing design system
 */

// Default toast options with brand styling
const defaultOptions: ExternalToast = {
  duration: 4000,
  closeButton: true,
  style: {
    background: "oklch(0.18 0.03 220)",
    border: "1px solid oklch(0.3 0.04 210)",
    color: "oklch(0.96 0.01 200)",
  },
};

// Success toast with accent colors (matching text-accent)
export const success = (message: string, options?: ExternalToast) => {
  return sonnerToast.success(message, {
    ...defaultOptions,
    duration: 4000,
    style: {
      background: 'hsl(var(--background))',
      border: '1px solid hsl(var(--accent) / 0.3)',
      color: 'hsl(var(--accent))',
      ...options?.style,
    },
    ...options,
  });
};

// Error toast with destructive colors (matching text-destructive)
export const error = (message: string, options?: ExternalToast) => {
  return sonnerToast.error(message, {
    ...defaultOptions,
    duration: 6000, // Longer for errors
    style: {
      background: "oklch(0.2 0.05 25)",
      border: "1px solid oklch(0.5 0.14 25 / 0.55)",
      color: "oklch(0.96 0.02 25)",
      ...options?.style,
    },
    ...options,
  });
};

// Warning toast with yellow colors (matching text-yellow-400)
export const warning = (message: string, options?: ExternalToast) => {
  return sonnerToast.warning(message, {
    ...defaultOptions,
    duration: 5000,
    style: {
      background: 'hsl(var(--background))',
      border: '1px solid rgb(234 179 8 / 0.3)', // yellow-500/30
      color: 'rgb(250 204 21)', // yellow-400
      ...options?.style,
    },
    ...options,
  });
};

// Info toast with default colors
export const info = (message: string, options?: ExternalToast) => {
  return sonnerToast.info(message, {
    ...defaultOptions,
    duration: 3000,
    ...options,
  });
};

// Loading toast for async operations
export const loading = (message: string, options?: ExternalToast) => {
  return sonnerToast.loading(message, {
    ...defaultOptions,
    duration: Infinity, // Manual dismiss
    ...options,
  });
};

// Promise toast for handling async operations
export const promise = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: unknown) => string);
  },
  options?: ExternalToast
) => {
  return sonnerToast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    ...defaultOptions,
    ...options,
  });
};

// Configuration error toast (persistent until dismissed)
export const configError = (message: string, description?: string, action?: { label: string; onClick: () => void }) => {
  return sonnerToast.error(message, {
    description,
    duration: Infinity,
    closeButton: true,
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
    style: {
      background: 'hsl(var(--background))',
      border: '1px solid hsl(var(--destructive) / 0.5)',
      color: 'hsl(var(--destructive))',
    },
  });
};

// User rejection toast (brief, non-intrusive)
export const userRejected = (message: string) => {
  return sonnerToast.info(message, {
    duration: 2000,
    closeButton: false,
    style: {
      background: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      color: 'hsl(var(--muted-foreground))',
    },
  });
};

// Export the original toast for custom usage
export { sonnerToast as toast };

export const toastHelpers = {
  success,
  error,
  warning,
  info,
  loading,
  promise,
  configError,
  userRejected,
  toast: sonnerToast,
};