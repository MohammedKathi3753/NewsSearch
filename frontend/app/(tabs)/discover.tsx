import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { AppButton } from "@/src/components/AppButton";
import { Chip } from "@/src/components/Chip";
import { EmptyState } from "@/src/components/EmptyState";
import { EvidenceRow } from "@/src/components/EvidenceTrackCard";
import { Icon } from "@/src/components/Icon";
import { AppHeader, Screen, SectionHeader } from "@/src/components/Screen";
import { TextField } from "@/src/components/TextField";
import { useToast } from "@/src/components/Toast";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t } from "@/src/i18n";

export default function DiscoverScreen() {
  useAuthGuard();
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();
  const styles = useStyles();

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"" | "factcheck" | "news">("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: (payload: { q: string; k: string }) => api.discover(payload.q, payload.k),
    onError: (error) => toast.showToast((error as Error).message, "error"),
  });

  const runSearch = (rawQuery: string, rawKind: string) => {
    const q = rawQuery.trim();
    if (q.length < 2) {
      toast.showToast(t("discover.queryTooShort"), "error");
      return;
    }
    setSubmitted(q);
    searchMutation.mutate({ q, k: rawKind });
  };

  const items = searchMutation.data?.items ?? [];
  const failed = (searchMutation.data?.providers ?? []).filter(
    (p) => p.status === "error" || p.status === "cooldown",
  );

  return (
    <View style={styles.root} testID="discover-screen">
      <AppHeader title={t("discover.title")} />
      <Screen mode="form" withTopInset={false}>
        <TextField
          label={t("discover.inputLabel")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("discover.placeholder")}
          testID="discover-search-input"
        />
        <AppButton
          spaced
          label={searchMutation.isPending ? t("discover.searching") : t("discover.search")}
          loading={searchMutation.isPending}
          onPress={() => runSearch(query, kind)}
          testID="discover-submit-button"
        />
        <View style={styles.chipsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            <Chip
              label={t("discover.chipAll")}
              selected={kind === ""}
              onPress={() => {
                setKind("");
                if (submitted) runSearch(submitted, "");
              }}
              testID="discover-chip-all"
            />
            <Chip
              label={t("kind.factcheck")}
              selected={kind === "factcheck"}
              onPress={() => {
                setKind("factcheck");
                if (submitted) runSearch(submitted, "factcheck");
              }}
              testID="discover-chip-factcheck"
            />
            <Chip
              label={t("kind.news")}
              selected={kind === "news"}
              onPress={() => {
                setKind("news");
                if (submitted) runSearch(submitted, "news");
              }}
              testID="discover-chip-news"
            />
          </ScrollView>
        </View>
        <Pressable testID="discover-sources-link" style={styles.sourcesLink} onPress={() => router.push("/sources")}>
          <Text style={styles.sourcesLinkText}>{t("discover.sourcesCta")}</Text>
          <Icon name="chevron-forward" size={16} color={colors.info} />
        </Pressable>
        {searchMutation.isPending ? <ActivityIndicator style={styles.loader} color={colors.brandPrimary} /> : null}
        {searchMutation.data ? (
          <View style={styles.results}>
            <SectionHeader eyebrow={submitted ?? undefined} title={`${t("discover.resultsTitle")} (${items.length})`} />
            {items.length === 0 ? (
              <Text style={styles.noResults}>{t("discover.noResults")}</Text>
            ) : (
              <View style={styles.list}>
                {items.map((item, index) => (
                  <EvidenceRow key={item.fingerprint} item={item} index={index} />
                ))}
              </View>
            )}
            {failed.length > 0 ? (
              <Text style={styles.providerNote}>
                {t("analyze.providerFailureNote")} {failed.map((p) => p.provider).join(", ")}
              </Text>
            ) : null}
          </View>
        ) : !searchMutation.isPending ? (
          <EmptyState icon="globe-outline" title={t("discover.hintTitle")} body={t("discover.hintBody")} />
        ) : null}
      </Screen>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  chipsRow: { marginVertical: spacing.md },
  chipsContent: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  sourcesLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    minHeight: 48,
  },
  sourcesLinkText: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.info },
  loader: { marginVertical: spacing.lg },
  results: { marginTop: spacing.md },
  list: { gap: spacing.md },
  noResults: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted },
  providerNote: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.warning, marginTop: spacing.md },
}));
