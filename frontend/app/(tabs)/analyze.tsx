import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppButton } from "@/src/components/AppButton";
import { Chip } from "@/src/components/Chip";
import { EvidenceTrackCard } from "@/src/components/EvidenceTrackCard";
import { Icon } from "@/src/components/Icon";
import { MlTrackCard } from "@/src/components/MlTrackCard";
import { AppHeader, Screen } from "@/src/components/Screen";
import { ShareSheet } from "@/src/components/ShareSheet";
import { TextField } from "@/src/components/TextField";
import { VerdictCard } from "@/src/components/VerdictCard";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { getLocale, t, useLocale } from "@/src/i18n";

export default function AnalyzeScreen() {
  useLocale();
  const [shareOpen, setShareOpen] = useState(false);
  const ready = useAuthGuard();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const styles = useStyles();

  const [mode, setMode] = useState<"text" | "url">("text");
  const [claim, setClaim] = useState("");
  const [url, setUrl] = useState("");

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    enabled: ready,
  });
  const unread = notificationsQuery.data?.filter((n) => !n.read).length ?? 0;

  const mutation = useMutation({
    mutationFn: api.analyze,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
  });

  const result = mutation.data;

  const submit = () => {
    if (mutation.isPending) return;
    if (mode === "url" ? !url.trim() : !claim.trim()) return;
    mutation.mutate(
      mode === "url" ? { url: url.trim(), lang: getLocale() } : { text: claim.trim(), lang: getLocale() },
    );
  };

  return (
    <View style={styles.root} testID="analyze-screen">
      <AppHeader
        title={t("analyze.title")}
        right={
          <Pressable testID="analyze-notifications-button" onPress={() => router.push("/alerts")} style={styles.bell}>
            <Icon name="notifications-outline" size={22} color={colors.onSurface} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? "9+" : String(unread)}</Text>
              </View>
            ) : null}
          </Pressable>
        }
      />
      <Screen mode="form" withTopInset={false}>
        {mutation.isError ? (
          <View style={styles.errorBanner} testID="analyze-error-banner">
            <Text style={styles.errorText}>{(mutation.error as Error).message}</Text>
          </View>
        ) : null}
        <View style={styles.modeRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRowContent}>
            <Chip
              label={t("analyze.modeText")}
              selected={mode === "text"}
              onPress={() => setMode("text")}
              testID="analyze-mode-text-chip"
            />
            <Chip
              label={t("analyze.modeUrl")}
              selected={mode === "url"}
              onPress={() => setMode("url")}
              testID="analyze-mode-url-chip"
            />
          </ScrollView>
        </View>
        {mode === "text" ? (
          <TextField
            label={t("analyze.textInputLabel")}
            value={claim}
            onChangeText={setClaim}
            placeholder={t("analyze.textPlaceholder")}
            multiline
            testID="analyze-text-input"
          />
        ) : (
          <TextField
            label={t("analyze.urlInputLabel")}
            value={url}
            onChangeText={setUrl}
            placeholder={t("analyze.urlPlaceholder")}
            keyboardType="url"
            testID="analyze-url-input"
          />
        )}
        <AppButton
          spaced
          label={mutation.isPending ? t("analyze.submitting") : t("analyze.submit")}
          loading={mutation.isPending}
          onPress={submit}
          testID="analyze-submit-button"
        />
        {result ? (
          <View style={styles.results}>
            {!result.persisted ? <Text style={styles.notSaved}>{t("analyze.notSaved")}</Text> : null}
            <VerdictCard verdict={result.evidence_verdict} />
            <EvidenceTrackCard
              items={result.evidence_track.items}
              summary={result.evidence_track.summary}
              providersFailed={result.evidence_track.providers_failed}
            />
            <MlTrackCard ml={result.ml_track} />
            {result.id ? (
              <AppButton label={t("share.button")} variant="outline" onPress={() => setShareOpen(true)} testID="analyze-share-button" />
            ) : null}
            <Text style={styles.separationNote} testID="analyze-separation-note">
              {t("analyze.separationNote")}
            </Text>
          </View>
        ) : (
          <View style={styles.hint}>
            <Text style={styles.hintTitle}>{t("analyze.hintTitle")}</Text>
            <Text style={styles.hintBody}>{t("analyze.hintBody")}</Text>
          </View>
        )}
      </Screen>
      {result?.id ? <ShareSheet analysisId={result.id} visible={shareOpen} onClose={() => setShareOpen(false)} /> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  bell: { width: 32, height: 32, alignItems: "flex-end", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.onError },
  modeRow: { marginBottom: spacing.md },
  modeRowContent: { flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingHorizontal: 0 },
  errorBanner: { borderWidth: 1, borderColor: colors.error, padding: spacing.md, marginBottom: spacing.md },
  errorText: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.error },
  results: { gap: spacing.lg, marginTop: spacing.xl },
  notSaved: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.warning },
  separationNote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.muted,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
  },
  hint: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.divider, padding: spacing.lg, gap: spacing.sm },
  hintTitle: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.onSurface },
  hintBody: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted, lineHeight: 22 },
}));
