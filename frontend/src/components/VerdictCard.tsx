import { Linking, Pressable, Text, View } from "react-native";

import { Badge } from "./Badge";
import { Icon } from "./Icon";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t } from "@/src/i18n";
import type { EvidenceVerdict } from "@/src/types";

const TONE = { supported: "olive", contradicted: "error", mixed: "warning", insufficient: "neutral" } as const;

export function VerdictCard({ verdict }: { verdict: EvidenceVerdict }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const value = verdict.verdict;

  return (
    <View style={styles.card} testID="analyze-verdict-card">
      <Text style={styles.title}>{t("verdict.title")}</Text>
      <Text style={styles.subtitle}>{t("verdict.subtitle")}</Text>
      {!verdict.available || !value ? (
        <Text style={styles.muted}>
          {verdict.reason === "groq_not_configured" ? t("analyze.groqNotConfigured") : t("verdict.unavailable")}
        </Text>
      ) : (
        <View style={styles.stack}>
          <View style={styles.row}>
            <Badge label={t(`verdict.${value}`)} tone={TONE[value]} testID="analyze-verdict-badge" />
            {verdict.confidence ? (
              <Text style={styles.confidence} testID="analyze-verdict-confidence">
                {t("verdict.confidence")}: {t(`verdict.conf_${verdict.confidence}`)}
              </Text>
            ) : null}
          </View>
          <Text style={styles.headline}>{t(`verdict.${value}Body`)}</Text>
          {verdict.reasoning ? <Text style={styles.body}>{verdict.reasoning}</Text> : null}
          {verdict.citations && verdict.citations.length > 0 ? (
            <View style={styles.citations}>
              <Text style={styles.citationsTitle}>{t("verdict.citedSources")}</Text>
              {verdict.citations.map((citation) => (
                <Pressable
                  key={citation.fingerprint}
                  style={styles.citation}
                  onPress={() => Linking.openURL(citation.url).catch(() => {})}
                  testID={`verdict-citation-${citation.index}`}
                >
                  <Text style={styles.citationIndex}>[{citation.index}]</Text>
                  <Text style={styles.citationText} numberOfLines={2}>
                    {citation.title}
                  </Text>
                  <Icon name="open-outline" size={14} color={colors.info} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.muted}>{t("verdict.aiNote")}</Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.onSurface,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
  },
  stack: { gap: spacing.md, marginTop: spacing.md },
  title: { fontFamily: fonts.extraBold, fontSize: fontSizes.lg, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  confidence: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.muted },
  headline: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.onSurface },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 22 },
  citations: { gap: spacing.xs },
  citationsTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.onSurface },
  citation: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 36 },
  citationIndex: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.onSurface },
  citationText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.info },
  muted: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: spacing.sm },
}));
