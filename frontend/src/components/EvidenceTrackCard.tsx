import { Linking, Pressable, Text, View } from "react-native";
import dayjs from "dayjs";

import { Badge } from "./Badge";
import { Icon } from "./Icon";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t } from "@/src/i18n";
import type { AiBlock, EvidenceItem, ProviderStatusResult } from "@/src/types";

export function EvidenceRow({ item, index }: { item: EvidenceItem; index: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const date =
    item.published_at && dayjs(item.published_at).isValid() ? dayjs(item.published_at).format("MMM D, YYYY") : null;
  const metaParts = [item.source?.publisher, item.source?.domain, date, `via ${item.provider}`].filter(Boolean);
  const open = () => {
    Linking.openURL(item.url).catch(() => {});
  };
  return (
    <View style={styles.row} testID={`evidence-item-${index}`}>
      <View style={styles.badgeRow}>
        <Badge
          label={item.kind === "factcheck" ? t("kind.factcheck") : t("kind.news")}
          tone={item.kind === "factcheck" ? "olive" : "neutral"}
          testID={`evidence-kind-${index}`}
        />
        {item.source?.rating ? (
          <Badge label={item.source.rating} tone="terracotta" testID={`evidence-rating-${index}`} />
        ) : null}
      </View>
      <Text style={styles.itemTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {metaParts.join("  ·  ")}
      </Text>
      {item.snippet ? (
        <Text style={styles.snippet} numberOfLines={3}>
          {item.snippet}
        </Text>
      ) : null}
      <Pressable onPress={open} style={styles.openButton} testID={`evidence-open-${index}`}>
        <Icon name="open-outline" size={14} color={colors.info} />
        <Text style={styles.openText}>{t("common.openSource")}</Text>
      </Pressable>
    </View>
  );
}

export function EvidenceTrackCard({
  items,
  summary,
  providersFailed,
}: {
  items: EvidenceItem[];
  summary?: AiBlock;
  providersFailed: ProviderStatusResult[];
}) {
  const styles = useStyles();
  return (
    <View style={styles.card} testID="analyze-evidence-track">
      <Text style={styles.title}>{t("analyze.evidenceTrackTitle")}</Text>
      <Text style={styles.subtitle}>{t("analyze.evidenceTrackSubtitle")}</Text>
      {summary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{t("analyze.summaryTitle")}</Text>
          {summary.available && summary.text ? (
            <Text style={styles.body}>{summary.text}</Text>
          ) : (
            <Text style={styles.summaryNote}>
              {summary.reason === "groq_not_configured" ? t("analyze.groqNotConfigured") : t("analyze.summaryUnavailable")}
            </Text>
          )}
        </View>
      ) : null}
      {items.length === 0 ? (
        <Text style={styles.body}>{t("analyze.noEvidence")}</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => (
            <EvidenceRow key={item.fingerprint} item={item} index={index} />
          ))}
        </View>
      )}
      {providersFailed.length > 0 ? (
        <Text style={styles.warning}>
          {t("analyze.providerFailureNote")} {providersFailed.map((p) => p.provider).join(", ")}
        </Text>
      ) : null}
      <Text style={styles.footer}>{t("analyze.evidenceFooter")}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandSecondary,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  title: { fontFamily: fonts.extraBold, fontSize: fontSizes.lg, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: spacing.xs },
  summary: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.onSurface },
  summaryNote: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 22 },
  list: { marginTop: spacing.md },
  row: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  badgeRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  itemTitle: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 20 },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  snippet: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.onSurfaceSecondary, lineHeight: 19 },
  openButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs, minHeight: 32 },
  openText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.info },
  warning: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.warning, marginTop: spacing.sm },
  footer: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: spacing.md },
}));
