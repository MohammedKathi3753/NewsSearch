import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";

type Props = {
  label: string;
  onPress: () => void;
  testID: string;
  variant?: "solid" | "outline" | "danger";
  loading?: boolean;
  disabled?: boolean;
  /** Adds the standard gap above the button when it follows a field. */
  spaced?: boolean;
};

export function AppButton({ label, onPress, testID, variant = "solid", loading = false, disabled = false, spaced = false }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isDisabled = disabled || loading;
  const labelColor =
    variant === "solid" ? colors.onBrandPrimary : variant === "danger" ? colors.onError : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        spaced && styles.spaced,
        variant === "solid" && styles.solid,
        variant === "outline" && styles.outline,
        variant === "danger" && styles.danger,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  solid: { backgroundColor: colors.brandPrimary },
  spaced: { marginTop: spacing.md },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  danger: { backgroundColor: colors.error },
  pressed: { backgroundColor: colors.surfaceTertiary },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.bold, fontSize: fontSizes.base, letterSpacing: 0.3 },
}));
