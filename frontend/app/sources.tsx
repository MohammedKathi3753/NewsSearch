import { Linking, Pressable, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/src/components/Badge";
import { EmptyState } from "@/src/components/EmptyState";
import { Icon } from "@/src/components/Icon";
import { AppHeader, Screen } from "@/src/components/Screen";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t } from "@/src/i18n";

export default function SourcesScreen() {
  const sourcesQuery = useQuery({ queryKey: ["sources"], queryFn: api.sources });
  const { colors } = useTheme();
  const styles = useStyles();

  const sources = sourcesQuery.data?.sources ?? [];

  return (
    <View style={styles.root} testID="sources-screen">
      <AppHeader title={t("sources.title")} onBack />
      <Screen withTopInset={false}>
        <Text style={styles.subtitle}>{t("sources.subtitle")}</Text>
        {sourcesQuery.isPending ? (
          <Text style={styles.muted}>{t("common.loading")}…</Text>
        ) : sources.length === 0 ? (
          <EmptyState icon="library-outline" title={t("sources.empty")} />
        ) : (
          <View style={styles.list}>
            {sources.map((source, index) => (
              <View key={source.url} style={styles.item} testID={`sources-item-${index}`}>
                <Text style={styles.name}>{source.name}</Text>
                <View style={styles.badgeRow}>
                  <Badge label={source.type} tone="neutral" testID={`sources-type-${index}`} />
                  <Badge label={source.region} tone="olive" testID={`sources-region-${index}`} />
                </View>
                <Text style={styles.description}>{source.description}</Text>
                <Pressable
                  style={styles.openButton}
                  onPress={() => Linking.openURL(source.url).catch(() => {})}
                  testID={`sources-open-${index}`}
                >
                  <Icon name="open-outline" size={14} color={colors.info} />
                  <Text style={styles.openText}>{t("common.openLink")}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted, lineHeight: 22, marginBottom: spacing.lg },
  muted: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted },
  list: { gap: spacing.md },
  item: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.onSurface },
  badgeRow: { flexDirection: "row", gap: spacing.sm },
  description: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurfaceSecondary, lineHeight: 21 },
  openButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 32 },
  openText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.info },
}));
