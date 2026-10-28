import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";

type Tone = "error" | "success" | "info";

interface ToastContextValue {
  showToast: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: Tone; id: number } | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: Tone = "info") => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setToast({ message, tone, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View key={toast.id} pointerEvents="none" style={[styles.toast, { top: insets.top + spacing.sm }]}>
          <Text style={styles.text} testID="toast">
            {toast.message}
          </Text>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

const useStyles = makeStyles((colors) => ({
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.onSurfaceInverse,
  },
  text: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.onSurfaceInverse },
}));
