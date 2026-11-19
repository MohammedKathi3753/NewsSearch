import { Modal, Platform, Pressable, Share, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "./AppButton";
import { useToast } from "./Toast";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing } from "@/src/theme";
import { t } from "@/src/i18n";

export function shareUrls(token: string) {
  const web =
    Platform.OS === "web" && typeof window !== "undefined"
      ? `${window.location.origin}/shared/${token}`
      : `${process.env.EXPO_PUBLIC_BACKEND_URL ?? ""}/shared/${token}`;
  return { web, app: Linking.createURL(`shared/${token}`) };
}

async function sendLink(token: string) {
  const { web, app } = shareUrls(token);
  if (Platform.OS === "web") {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: object) => Promise<void> }) : null;
    if (nav?.share) {
      await nav.share({ title: "NewsSearch", url: web });
      return "shared";
    }
    await nav?.clipboard?.writeText(web);
    return "copied";
  }
  await Share.share({ message: `NewsSearch analysis\n${web}\n\nOpen in the app: ${app}` });
  return "shared";
}

export function ShareSheet({ analysisId, visible, onClose }: { analysisId: string; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();
  const styles = useStyles();

  const statusQuery = useQuery({
    queryKey: ["share", analysisId],
    queryFn: () => api.shareStatus(analysisId),
    enabled: visible,
    retry: false,
  });
  const token = statusQuery.data?.token ?? null;
  const statusError = statusQuery.isError ? (statusQuery.error as Error).message : null;

  const createMutation = useMutation({
    mutationFn: () => api.createShare(analysisId),
    onSuccess: async (data) => {
      queryClient.setQueryData(["share", analysisId], data);
      toast.showToast(t("share.created"), "success");
      const how = await sendLink(data.token).catch(() => null);
      if (how === "copied") toast.showToast(shareUrls(data.token).web, "info");
    },
    onError: (error) => toast.showToast((error as Error).message || t("share.failed"), "error"),
  });

  const stopMutation = useMutation({
    mutationFn: () => api.deleteShare(analysisId),
    onSuccess: () => {
      queryClient.setQueryData(["share", analysisId], { shared: false, token: null });
      toast.showToast(t("share.stopped"), "success");
      onClose();
    },
    onError: (error) => toast.showToast((error as Error).message, "error"),
  });

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.flex} onPress={onClose} testID="share-sheet-backdrop" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="share-sheet">
          <Text style={styles.title}>{t("share.title")}</Text>
          <Text style={styles.body}>{t("share.body")}</Text>
          {statusError ? (
            <Text style={styles.error} testID="share-error-text">
              {statusError}
            </Text>
          ) : null}
          {token ? (
            <Text style={styles.link} selectable testID="share-link-text">
              {shareUrls(token).web}
            </Text>
          ) : null}
          <View style={styles.stack}>
            {token ? (
              <>
                <AppButton
                  label={t("share.send")}
                  onPress={async () => {
                    const how = await sendLink(token).catch(() => null);
                    if (how === "copied") toast.showToast(shareUrls(token).web, "info");
                  }}
                  testID="share-send-button"
                />
                <AppButton
                  label={t("share.stop")}
                  variant="outline"
                  loading={stopMutation.isPending}
                  onPress={() => stopMutation.mutate()}
                  testID="share-stop-button"
                />
              </>
            ) : statusError ? null : (
              <AppButton
                label={t("share.create")}
                loading={createMutation.isPending || statusQuery.isPending}
                onPress={() => createMutation.mutate()}
                testID="share-create-button"
              />
            )}
            <AppButton label={t("common.cancel")} variant="outline" onPress={onClose} testID="share-cancel-button" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(44, 42, 41, 0.4)", justifyContent: "flex-end" },
  flex: { flex: 1 },
  sheet: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: fonts.extraBold, fontSize: fontSizes.lg, color: colors.onSurface },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.muted, lineHeight: 22 },
  link: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.info, borderWidth: 1, borderColor: colors.divider, padding: spacing.md },
  stack: { gap: spacing.sm },
  error: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.error, lineHeight: 19 },
}));
