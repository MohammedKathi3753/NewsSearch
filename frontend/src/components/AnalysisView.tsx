import { useMemo } from "react";
import { Text, View } from "react-native";
import dayjs from "dayjs";

import { EvidenceTrackCard } from "./EvidenceTrackCard";
import { MlTrackCard } from "./MlTrackCard";
import { VerdictCard } from "./VerdictCard";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { t } from "@/src/i18n";
import type { AnalysisDetail, MlTrack } from "@/src/types";

/** Read-only view of a stored analysis (history detail + shared snapshot). */
export function AnalysisView({ detail }: { detail: AnalysisDetail }) {
  const styles = useStyles();

  const ml: MlTrack = useMemo(() => {
    const pReal = detail.ml_probability;
    return {
      available: detail.ml_available && pReal !== null && pReal !== undefined,
      label: detail.ml_label ?? undefined,
      probabilities: pReal !== null && pReal !== undefined ? { real: pReal, fake: 1 - pReal } : undefined,
      reliability: detail.ml_features?.reliability ?? (detail.input_text.split(/\s+/).length < 80 ? "low" : "normal"),
      model_version: detail.ml_model_version,
    };
  }, [detail]);

  return (
    <View>
      <View style={styles.inputCard} testID="analysis-input-card">
        <Text style={styles.inputMeta}>
          {detail.input_type === "url" ? t("analyze.modeUrl") : t("analyze.modeText")} · {dayjs(detail.created_at).format("lll")}
        </Text>
        {detail.source_title ? <Text style={styles.sourceTitle}>{detail.source_title}</Text> : null}
        {detail.input_url ? (
          <Text style={styles.inputUrl} numberOfLines={1}>
            {detail.input_url}
          </Text>
        ) : null}
        <Text style={styles.inputText} numberOfLines={12}>
          {detail.input_text}
        </Text>
      </View>
      <View style={styles.tracks}>
        <VerdictCard
          verdict={
            detail.evidence_verdict
              ? { available: true, ...detail.evidence_verdict }
              : { available: false, reason: "not_recorded" }
          }
        />
        <EvidenceTrackCard
          items={detail.evidence ?? []}
          summary={{
            available: Boolean(detail.ai_summary),
            text: detail.ai_summary,
            reason: detail.ai_summary ? null : "not_recorded",
          }}
          providersFailed={detail.providers_failed ?? []}
        />
        <MlTrackCard ml={ml} />
        <Text style={styles.separationNote} testID="analysis-separation-note">
          {t("analyze.separationNote")}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
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
