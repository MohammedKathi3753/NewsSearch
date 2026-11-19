import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppButton } from "@/src/components/AppButton";
import { Badge } from "@/src/components/Badge";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { AppHeader, Screen, SectionHeader } from "@/src/components/Screen";
import { useToast } from "@/src/components/Toast";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { useSession } from "@/src/hooks/useSession";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { SUPPORTED_LOCALES, t, useLocale } from "@/src/i18n";

export default function SettingsScreen() {
  const { locale, setLocale } = useLocale();
  const ready = useAuthGuard();
  const { user, configured, signOut } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const styles = useStyles();

  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: api.me, enabled: ready });
  const readyQuery = useQuery({ queryKey: ["system-ready"], queryFn: api.ready, enabled: ready });
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: api.providers, enabled: ready });

  const clearMutation = useMutation({
    mutationFn: () => api.clearAnalyses(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      setConfirmClear(false);
      toast.showToast(t("settings.cleared"), "success");
    },
    onError: (error) => toast.showToast((error as Error).message, "error"),
  });

  const doSignOut = async () => {
    setConfirmSignOut(false);
    await signOut();
    router.replace("/sign-in");
  };

  const checks = readyQuery.data?.checks;

  const statusRow = (label: string, badge: ReactNode, testID: string) => (
    <View key={label} style={styles.statusRow} testID={testID}>
      <Text style={styles.statusLabel}>{label}</Text>
      {badge}
    </View>
  );

  const linkRow = (label: string, testID: string, onPress: () => void) => (
    <Pressable key={label} style={styles.linkRow} onPress={onPress} testID={testID}>
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.chevron}>→</Text>
    </Pressable>
  );

  return (
    <View style={styles.root} testID="settings-screen">
      <AppHeader title={t("settings.title")} />
      <Screen mode="scroll" withTopInset={false}>
        <SectionHeader title={t("settings.accountSection")} />
        <View style={styles.card} testID="settings-account-card">
          <Text style={styles.cardTitle}>{t("settings.signedInAs")}</Text>
          <Text style={styles.cardBody}>{meQuery.data?.user.email ?? user?.email ?? "—"}</Text>
        </View>

        <SectionHeader title={t("settings.languageSection")} />
        <View style={styles.card} testID="settings-language-card">
          {SUPPORTED_LOCALES.map((option) => {
            const selected = option.code === locale;
            return (
              <Pressable
                key={option.code}
                style={[styles.langRow, selected && styles.langRowSelected]}
                onPress={() => setLocale(option.code)}
                testID={`settings-language-${option.code}`}
              >
                <Text style={[styles.langLabel, selected && styles.langLabelSelected]}>{option.label}</Text>
                {selected ? <Text style={styles.langCheck}>✓</Text> : null}
              </Pressable>
            );
          })}
          <Text style={styles.hint}>{t("settings.languageHint")}</Text>
        </View>

        <SectionHeader title={t("settings.statusSection")} />
        <View style={styles.card}>
          {statusRow(
            t("settings.model"),
            <Badge
              label={checks?.model_loaded ? t("settings.modelReady") : t("settings.modelMissing")}
              tone={checks?.model_loaded ? "olive" : "warning"}
              testID="settings-model-badge"
            />,
            "settings-model-row",
          )}
          {statusRow(
            t("settings.aiNarratives"),
            <Badge
              label={checks?.groq_configured ? t("settings.configured") : t("settings.notConfigured")}
              tone={checks?.groq_configured ? "olive" : "neutral"}
              testID="settings-groq-badge"
            />,
            "settings-groq-row",
          )}
          {statusRow(
            "Supabase",
            <Badge
              label={configured && checks?.supabase_configured ? t("settings.configured") : t("settings.notConfigured")}
              tone={configured && checks?.supabase_configured ? "olive" : "neutral"}
              testID="settings-supabase-badge"
            />,
            "settings-supabase-row",
          )}
        </View>

        <SectionHeader title={t("settings.providersSection")} />
        <View style={styles.card}>
          {(providersQuery.data?.providers ?? []).map((provider) =>
            statusRow(
              provider.label,
              <Badge
                label={!provider.enabled ? "Key needed" : provider.status === "error" ? "Error" : provider.status === "cooldown" ? "Cooldown" : "Active"}
                tone={!provider.enabled ? "neutral" : provider.status === "error" ? "error" : provider.status === "cooldown" ? "warning" : "olive"}
                testID={`settings-provider-${provider.name}`}
              />,
              `settings-provider-row-${provider.name}`,
            ),
          )}
        </View>

        <SectionHeader title={t("settings.dataSection")} />
        <View style={styles.card}>
          <Text style={styles.cardBody}>{t("settings.retentionBody")}</Text>
          <AppButton
            label={t("settings.clearHistory")}
            variant="outline"
            onPress={() => setConfirmClear(true)}
            testID="settings-clear-history-button"
          />
        </View>

        <SectionHeader title={t("settings.legalSection")} />
        <View style={styles.card}>
          {linkRow(t("settings.sourcesLink"), "settings-sources-link", () => router.push("/sources"))}
          {linkRow(t("settings.terms"), "settings-terms-link", () => router.push("/terms"))}
          {linkRow(t("settings.privacy"), "settings-privacy-link", () => router.push("/privacy"))}
        </View>

        <View style={styles.signOutWrap}>
          <AppButton label={t("settings.signOut")} variant="danger" onPress={() => setConfirmSignOut(true)} testID="settings-signout-button" />
        </View>
      </Screen>
      <ConfirmSheet
        visible={confirmSignOut}
        title={t("settings.signOut")}
        body={t("settings.signOutBody")}
        confirmLabel={t("settings.signOut")}
        tone="solid"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={doSignOut}
        testIDPrefix="settings-signout"
      />
      <ConfirmSheet
        visible={confirmClear}
        title={t("history.clearTitle")}
        body={t("history.clearBody")}
        confirmLabel={t("history.clearAll")}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => clearMutation.mutate()}
        testIDPrefix="settings-clear"
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
  cardTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  cardBody: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 22 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md, minHeight: 32 },
  statusLabel: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.onSurface, flexShrink: 1 },
  linkRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44 },
  linkLabel: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.info },
  chevron: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.muted },
  signOutWrap: { marginTop: spacing.xl },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  langRowSelected: { borderColor: colors.border, backgroundColor: colors.brandTertiary },
  langLabel: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.onSurface },
  langLabelSelected: { color: colors.onSurface },
  langCheck: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.onSurface },
  hint: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted, lineHeight: 19, marginTop: spacing.xs },
}));
