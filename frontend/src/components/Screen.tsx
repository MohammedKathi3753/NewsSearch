import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "./Icon";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";

type ScreenProps = {
  children: ReactNode;
  mode?: "scroll" | "form" | "view";
  /** Screens with a custom header pass withTopInset={false}. */
  withTopInset?: boolean;
  /** Full-screen (non-tab) screens pad for the device bottom inset. */
  fullScreen?: boolean;
  testID?: string;
};

export function Screen({ children, mode = "scroll", withTopInset = true, fullScreen = false, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();

  let bottomPad = spacing.xl;
  if (fullScreen) {
    bottomPad += insets.bottom;
  } else if (usesNativeTabs) {
    // Inside native bottom tabs, insets.bottom already includes the tab bar.
    bottomPad += insets.bottom;
  }
  const topPad = withTopInset ? insets.top + spacing.lg : spacing.sm;

  if (mode === "view") {
    return (
      <View
        testID={testID}
        style={[styles.flex, { backgroundColor: colors.surface, paddingTop: topPad, paddingBottom: bottomPad }]}
      >
        {children}
      </View>
    );
  }

  const ScrollImpl = mode === "form" ? KeyboardAwareScrollView : ScrollView;
  return (
    <ScrollImpl
      testID={testID}
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: bottomPad,
        paddingHorizontal: spacing.lg,
        alignSelf: "center",
        width: "100%",
        maxWidth: 720,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollImpl>
  );
}

export function AppHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: boolean;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useStyles();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable testID="header-back-button" onPress={() => router.back()} style={styles.iconSlot} hitSlop={8}>
            <Icon name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {right ?? null}
      </View>
    </View>
  );
}

export function SectionHeader({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  iconSlot: { width: 32, height: 32, alignItems: "flex-start", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.extraBold, fontSize: fontSizes.xl, color: colors.onSurface },
  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.md },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sectionTitle: { fontFamily: fonts.extraBold, fontSize: fontSizes.lg, color: colors.onSurface },
}));
