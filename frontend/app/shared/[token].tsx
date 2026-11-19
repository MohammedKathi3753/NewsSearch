import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import { AnalysisView } from "@/src/components/AnalysisView";
import { AppHeader, Screen } from "@/src/components/Screen";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t, useLocale } from "@/src/i18n";

export default function SharedAnalysisScreen() {
  useLocale();
  const { token } = useLocalSearchParams<{ token: string }>();
  const ready = useAuthGuard();
  const { colors } = useTheme();
  const styles = useStyles();

  const sharedQuery = useQuery({
    queryKey: ["shared", token],
    queryFn: () => api.shared(token as string),
    enabled: ready && Boolean(token),
    retry: false,
  });

  return (
    <View style={styles.root} testID="shared-analysis-screen">
      <AppHeader title={t("shared.title")} onBack />
      {!ready || sharedQuery.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="small" />
        </View>
      ) : sharedQuery.isError || !sharedQuery.data ? (
        <View style={styles.center}>
          <Text style={styles.muted} testID="shared-not-found">
            {t("shared.notFound")}
          </Text>
        </View>
      ) : (
        <Screen withTopInset={false} fullScreen>
          <Text style={styles.notice} testID="shared-notice">
            {t("shared.notice").replace("{date}", dayjs(sharedQuery.data.shared_at).format("ll"))}
          </Text>
          <AnalysisView detail={sharedQuery.data.analysis} />
        </Screen>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  muted: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.muted, textAlign: "center" },
  notice: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginBottom: spacing.md },
}));
