import { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { EvidenceTrackCard } from "@/src/components/EvidenceTrackCard";
import { MlTrackCard } from "@/src/components/MlTrackCard";
import { AppHeader, Screen } from "@/src/components/Screen";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { t } from "@/src/i18n";
import type { MlTrack } from "@/src/types";

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ready = useAuthGuard();
  const styles = useStyles();

  const detailQuery = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => api.analysis(id as string),
    enabled: ready && Boolean(id),
  });

  const detail = detailQuery.data;

  const mlTrack: MlTrack | null = useMemo(() => {
    if (!detail) return null;
    const pReal = detail.ml_probability;
    return {
      available: detail.ml_available,
      label: detail.ml_label ?? undefined,
      probabilities:
        pReal !== null && pReal !== undefined ? { real: pReal, fake: 1 - pReal } : undefined,
      confidence:
        pReal !== null && pReal !== undefined ? Math.max(pReal, 1 - pReal) : undefined,
      top_features: detail.ml_features?.top ?? [],
      model_version: detail.ml_model_version,
    };
  }, [detail]);

  return (
    <View style={styles.root} testID="analysis-detail-screen">
      <AppHeader title={t("analysis.detailTitle")} onBack />
      {!ready || detailQuery.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C87965" size="small" />
        </View>
      ) : detailQuery.isError || !detail ? (
        <View style={styles.center}>
          <Text style={styles.notFound}>{(detailQuery.error as Error | null)?.message ?? t("history.loadFailed")}</Text>
        </View>
      ) : (
        <Screen withTopInset={false}>
          <View style={styles.inputCard} testID="analysis-input-card">
            <Text style={styles.inputMeta}>
              {detail.input_type === "url" ? t("analyze.modeUrl") : t("analyze.modeText")} ·{" "}
              {new Date(detail.created_at).toLocaleString()}
            </Text>
            {detail.source_title ? <Text style={styles.sourceTitle}>{detail.source_title}</Text> : null}
            {detail.input_url ? <Text style={styles.inputUrl} numberOfLines={1}>{detail.input_url}</Text> : null}
            <Text style={styles.inputText}>{detail.input_text}</Text>
          </View>
          <View style={styles.tracks}>
            {mlTrack ? <MlTrackCard ml={mlTrack} explanation={{
              available: Boolean(detail.ai_explanation),
              text: detail.ai_explanation,
              reason: detail.ai_explanation ? null : "groq_not_configured",
            }} /> : null}
            <EvidenceTrackCard
              items={detail.evidence}
              summary={{
                available: Boolean(detail.ai_summary),
                text: detail.ai_summary,
                reason: detail.ai_summary ? null : "groq_not_configured",
              }}
              providersFailed={detail.providers_failed}
            />
            <Text style={styles.separationNote} testID="analysis-separation-note">
              {t("analyze.separationNote")}
            </Text>
          </View>
        </Screen>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  notFound: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.muted, textAlign: "center" },
  inputCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, padding: spacing.md, gap: spacing.sm },
  inputMeta: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  sourceTitle: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.onSurface },
  inputUrl: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.info },
  inputText: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 22 },
  tracks: { gap: spacing.lg, marginTop: spacing.lg },
  separationNote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.muted,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
  },
}));
