import { Text, View } from "react-native";
import dayjs from "dayjs";

import { Badge } from "./Badge";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t } from "@/src/i18n";
import type { AiBlock, MlTrack } from "@/src/types";

export function MlTrackCard({ ml, explanation }: { ml: MlTrack; explanation?: AiBlock }) {
  const { colors } = useTheme();
  const styles = useStyles();

  const pctReal = Math.round((ml.probabilities?.real ?? 0) * 1000) / 10;
  const pctFake = Math.round((ml.probabilities?.fake ?? 0) * 1000) / 10;
  const trainedAt = ml.trained_at && dayjs(ml.trained_at).isValid() ? dayjs(ml.trained_at).format("MMM D, YYYY") : null;

  return (
    <View style={styles.card} testID="analyze-ml-track">
      <Text style={styles.title}>{t("analyze.mlTrackTitle")}</Text>
      <Text style={styles.subtitle}>{t("analyze.mlTrackSubtitle")}</Text>
      {!ml.available ? (
        <Text style={styles.body}>{t("analyze.mlUnavailable")}</Text>
      ) : (
        <View style={styles.stack}>
          <View style={styles.labelRow}>
            <Badge
              label={ml.label === "FAKE" ? t("analyze.mlLabelFake") : t("analyze.mlLabelReal")}
              tone={ml.label === "FAKE" ? "error" : "olive"}
              testID="analyze-ml-label-badge"
            />
            <Text style={styles.confidence}>
              {t("analyze.confidenceLabel")}: {Math.round((ml.confidence ?? 0) * 100)}%
            </Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barReal, { width: `${pctReal}%` }]} />
            <View style={styles.barFake} />
          </View>
          <View style={styles.probRow}>
            <Text style={[styles.probText, styles.probRealText]}>
              {t("analyze.probabilityReal")} {pctReal}%
            </Text>
            <Text style={[styles.probText, styles.probFakeText]}>
              {t("analyze.probabilityFake")} {pctFake}%
            </Text>
          </View>
          {ml.top_features && ml.top_features.length > 0 ? (
            <View style={styles.features}>
              <Text style={styles.featuresTitle}>{t("analyze.topFeaturesTitle")}</Text>
              {ml.top_features.map((feature) => (
                <View key={feature.feature} style={styles.featureRow}>
                  <Text style={styles.featureName} numberOfLines={1}>
                    {feature.feature}
                  </Text>
                  <Text
                    style={[
                      styles.featureValue,
                      { color: feature.direction === "real" ? colors.success : colors.error },
                    ]}
                  >
                    {feature.contribution.toFixed(3)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {ml.model_version ? (
            <Text style={styles.meta}>
              {ml.model_version}
              {trainedAt ? ` · ${trainedAt}` : ""}
            </Text>
          ) : null}
        </View>
      )}
      {explanation ? (
        <View style={styles.explanation}>
          <Text style={styles.explanationTitle}>{t("analyze.explanationTitle")}</Text>
          {explanation.available && explanation.text ? (
            <View style={styles.stack}>
              <Text style={styles.body}>{explanation.text}</Text>
              <Text style={styles.aiNote}>{t("analyze.explanationAiNote")}</Text>
            </View>
          ) : (
            <Text style={styles.aiNote}>
              {explanation.reason === "groq_not_configured" ? t("analyze.groqNotConfigured") : t("analyze.explanationUnavailable")}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandPrimary,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  stack: { gap: spacing.md },
  title: { fontFamily: fonts.extraBold, fontSize: fontSizes.lg, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: spacing.xs },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 22, marginTop: spacing.md },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, gap: spacing.md },
  confidence: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.muted },
  bar: { height: 8, flexDirection: "row", borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surfaceTertiary },
  barReal: { backgroundColor: colors.success },
  barFake: { flex: 1, backgroundColor: colors.error },
  probRow: { flexDirection: "row", justifyContent: "space-between" },
  probText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm },
  probRealText: { color: colors.success },
  probFakeText: { color: colors.error },
  features: { marginTop: spacing.sm, gap: spacing.xs },
  featuresTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.onSurface, marginBottom: spacing.xs },
  featureRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  featureName: { flex: 1, fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.onSurface },
  featureValue: { fontFamily: fonts.bold, fontSize: fontSizes.sm },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: spacing.sm },
  explanation: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  explanationTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.onSurface, marginBottom: spacing.xs },
  aiNote: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
}));
