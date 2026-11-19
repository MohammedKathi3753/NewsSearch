import { Text, View } from "react-native";

import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { t } from "@/src/i18n";
import type { MlTrack } from "@/src/types";

/** Secondary, de-emphasised writing-style signal. Never part of the verdict. */
export function MlTrackCard({ ml }: { ml: MlTrack }) {
  const styles = useStyles();
  const pctReal = Math.round((ml.probabilities?.real ?? 0) * 1000) / 10;

  return (
    <View style={styles.card} testID="analyze-ml-track">
      <Text style={styles.title}>{t("ml.title")}</Text>
      <Text style={styles.subtitle}>{t("ml.subtitle")}</Text>
      {!ml.available ? (
        <Text style={styles.note}>{t("analyze.mlUnavailable")}</Text>
      ) : (
        <View style={styles.stack}>
          <Text style={styles.label} testID="analyze-ml-label">
            {ml.label === "FAKE" ? t("ml.styleFake") : t("ml.styleReal")}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.barReal, { width: `${pctReal}%` }]} />
            <View style={styles.barFake} />
          </View>
          <View style={styles.probRow}>
            <Text style={styles.prob}>
              {t("analyze.probabilityReal")} {pctReal}%
            </Text>
            <Text style={styles.prob}>
              {t("analyze.probabilityFake")} {Math.round((100 - pctReal) * 10) / 10}%
            </Text>
          </View>
          {ml.reliability === "low" ? (
            <Text style={styles.warning} testID="analyze-ml-low-reliability">
              {t("ml.lowReliability")}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.md },
  stack: { gap: spacing.sm, marginTop: spacing.md },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.onSurface },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: spacing.xs },
  label: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.onSurface },
  bar: { height: 6, flexDirection: "row", backgroundColor: colors.surfaceTertiary },
  barReal: { backgroundColor: colors.muted },
  barFake: { flex: 1, backgroundColor: colors.surfaceTertiary },
  probRow: { flexDirection: "row", justifyContent: "space-between" },
  prob: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  note: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, marginTop: spacing.sm },
  warning: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.error, lineHeight: 19 },
}));
