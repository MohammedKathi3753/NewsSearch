import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { AnalysisView } from "@/src/components/AnalysisView";
import { AppHeader, Screen } from "@/src/components/Screen";
import { ShareSheet } from "@/src/components/ShareSheet";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t, useLocale } from "@/src/i18n";
import { Pressable } from "react-native";
import { Icon } from "@/src/components/Icon";

export default function AnalysisDetailScreen() {
  useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useAuthGuard();
  const { colors } = useTheme();
  const styles = useStyles();
  const [shareOpen, setShareOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => api.analysis(id as string),
    enabled: ready && Boolean(id),
  });
  const detail = detailQuery.data;

  return (
    <View style={styles.root} testID="analysis-detail-screen">
      <AppHeader
        title={t("analysis.detailTitle")}
        onBack
        right={
          detail ? (
            <Pressable testID="analysis-share-button" onPress={() => setShareOpen(true)} style={styles.shareBtn} hitSlop={8}>
              <Icon name="share-outline" size={20} color={colors.onSurface} />
              <Text style={styles.shareText}>{t("share.button")}</Text>
            </Pressable>
          ) : undefined
        }
      />
      {!ready || detailQuery.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="small" />
        </View>
      ) : detailQuery.isError || !detail ? (
        <View style={styles.center}>
          <Text style={styles.notFound}>{(detailQuery.error as Error | null)?.message ?? t("history.loadFailed")}</Text>
        </View>
      ) : (
        <Screen withTopInset={false} fullScreen>
          <AnalysisView detail={detail} />
        </Screen>
      )}
      {id ? <ShareSheet analysisId={id} visible={shareOpen} onClose={() => setShareOpen(false)} /> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  notFound: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.muted, textAlign: "center" },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44 },
  shareText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.onSurface },
}));
