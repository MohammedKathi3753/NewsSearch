import { useEffect } from "react";
import { FlatList, Linking, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";

import { EmptyState } from "@/src/components/EmptyState";
import { AppHeader } from "@/src/components/Screen";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { api } from "@/src/lib/api";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t, useLocale } from "@/src/i18n";

export default function AlertsScreen() {
  useLocale();
  const ready = useAuthGuard();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    enabled: ready,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = listQuery.data?.filter((n) => !n.read).length ?? 0;

  useEffect(() => {
    if (unread > 0) {
      const timer = setTimeout(() => markAllMutation.mutate(), 1200);
      return () => clearTimeout(timer);
    }
  }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps

  const headerRight =
    unread > 0 ? (
      <Pressable testID="alerts-mark-all-button" onPress={() => markAllMutation.mutate()} hitSlop={8}>
        <Text style={styles.markAll}>{t("alerts.markAll")}</Text>
      </Pressable>
    ) : undefined;

  return (
    <View style={styles.root} testID="alerts-screen">
      <AppHeader title={t("alerts.title")} onBack right={headerRight} />
      <FlatList
        data={listQuery.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            testID={`alerts-item-${item.id}`}
            style={styles.item}
            onPress={() => {
              if (item.analysis_id) {
                router.push({ pathname: "/analysis/[id]", params: { id: item.analysis_id } });
              } else if (item.evidence_url) {
                Linking.openURL(item.evidence_url).catch(() => {});
              }
            }}
          >
            <View style={styles.topRow}>
              {!item.read ? <View style={styles.unreadDot} testID={`alerts-unread-${item.id}`} /> : null}
              <Text style={styles.date}>{dayjs(item.created_at).format("lll")}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body} numberOfLines={2}>
              {item.body}
            </Text>
            {item.evidence_provider ? <Text style={styles.provider}>via {item.evidence_provider}</Text> : null}
          </Pressable>
        )}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={listQuery.isRefetching} onRefresh={() => {
            listQuery.refetch();
          }} tintColor={colors.brandPrimary} />
        }
        ListEmptyComponent={
          !listQuery.isLoading && !listQuery.isError ? (
            <EmptyState icon="notifications-off-outline" title={t("alerts.empty")} body={t("alerts.emptyBody")} />
          ) : undefined
        }
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  markAll: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.info, textDecorationLine: "underline" },
  item: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.xs },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  unreadDot: { width: 8, height: 8, backgroundColor: colors.error },
  date: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  title: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.onSurface },
  body: { fontFamily: fonts.regular, fontSize: fontSizes.base, color: colors.onSurfaceSecondary, lineHeight: 20 },
  provider: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
}));
