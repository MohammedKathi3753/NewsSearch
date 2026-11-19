import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useSession } from "@/src/hooks/useSession";
import { fonts, fontSizes, makeStyles, useTheme } from "@/src/theme";
import { t, useLocale } from "@/src/i18n";

export default function Index() {
  useLocale();
  const { initialized, user } = useSession();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();

  useEffect(() => {
    if (initialized) {
      router.replace(user ? "/analyze" : "/sign-in");
    }
  }, [initialized, user, router]);

  return (
    <View style={styles.container} testID="entry-splash">
      <Text style={styles.title}>{t("common.appName")}</Text>
      <Text style={styles.tagline}>{t("common.tagline")}</Text>
      <ActivityIndicator size="small" color={colors.brandPrimary} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  title: { fontFamily: fonts.extraBold, fontSize: fontSizes.xxl + 4, color: colors.onSurface },
  tagline: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted },
}));
