import { Text, View, type ViewStyle, type TextStyle } from "react-native";

import { fonts, makeStyles } from "@/src/theme";

type Tone = "olive" | "terracotta" | "neutral" | "error" | "warning";

export function Badge({ label, tone = "neutral", testID }: { label: string; tone?: Tone; testID?: string }) {
  const styles = useStyles();
  const tones: Record<Tone, { bg: ViewStyle; fg: TextStyle }> = {
    olive: { bg: styles.olive, fg: styles.oliveText },
    terracotta: { bg: styles.terracotta, fg: styles.terracottaText },
    neutral: { bg: styles.neutral, fg: styles.neutralText },
    error: { bg: styles.error, fg: styles.errorText },
    warning: { bg: styles.warning, fg: styles.warningText },
  };
  return (
    <View style={[styles.badge, tones[tone].bg]} testID={testID}>
      <Text style={[styles.label, tones[tone].fg]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  badge: { paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },
  olive: { backgroundColor: colors.brandSecondary },
  oliveText: { color: colors.onBrandSecondary },
  terracotta: { backgroundColor: colors.brandPrimary },
  terracottaText: { color: colors.onBrandPrimary },
  neutral: { backgroundColor: colors.surfaceTertiary },
  neutralText: { color: colors.onSurfaceTertiary },
  error: { backgroundColor: colors.error },
  errorText: { color: colors.onError },
  warning: { backgroundColor: colors.warning },
  warningText: { color: colors.onWarning },
  label: { fontFamily: fonts.bold, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
}));
