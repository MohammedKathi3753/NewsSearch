import type { AnalysisListItem } from "@/src/types";
import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";

import { Badge } from "@/src/components/Badge";
import { AppButton } from "@/src/components/AppButton";
import { ConfirmSheet } from "@/src/components/ConfirmSheet";
import { EmptyState } from "@/src/components/EmptyState";
import { Icon } from "@/src/components/Icon";
import { AppHeader } from "@/src/components/Screen";
import { useToast } from "@/src/components/Toast";
import { useAuthGuard } from "@/src/hooks/useAuthGuard";
import { api } from "@/src/lib/api";
import { exportHistory, type ExportFormat } from "@/src/lib/exportFile";
import { fonts, fontSizes, makeStyles, spacing, useTheme } from "@/src/theme";
import { t, useLocale } from "@/src/i18n";
import { usesNativeTabs } from "@/src/navigation";

export default function HistoryScreen() {
  useLocale();
  const ready = useAuthGuard();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const styles = useStyles();

  const listQuery = useQuery({
    queryKey: ["analyses"],
    queryFn: api.analyses,
    enabled: ready,
  });

  const [deleteTarget, setDeleteTarget] = useState<AnalysisListItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAnalysis(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      setDeleteTarget(null);
      toast.showToast(t("history.deleted"), "success");
    },
    onError: (error) => toast.showToast((error as Error).message, "error"),
  });

  const clearMutation = useMutation({
    mutationFn: () => api.clearAnalyses(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      setConfirmClear(false);
      toast.showToast(t("history.cleared"), "success");
    },
    onError: (error) => toast.showToast((error as Error).message, "error"),
  });

  const onRefresh = useCallback(() => {
    listQuery.refetch();
  }, [listQuery]);

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const runExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      await exportHistory(format);
      toast.showToast(t("history.exportReady"), "success");
      setExportOpen(false);
    } catch (error) {
      toast.showToast((error as Error).message || t("history.exportFailed"), "error");
    } finally {
      setExporting(null);
    }
  };

  const headerRight = (
    <View style={styles.headerActions}>
      <Pressable testID="history-export-button" onPress={() => setExportOpen(true)} style={styles.headerAction}>
        <Text style={styles.exportLink}>{t("history.export")}</Text>
      </Pressable>
      <Pressable testID="history-clear-all-button" onPress={() => setConfirmClear(true)} style={styles.headerAction}>
        <Text style={styles.clearAll}>{t("history.clearAll")}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.root} testID="history-screen">
      <AppHeader title={t("history.title")} right={headerRight} />
      <FlatList
        data={listQuery.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            testID={`history-item-${item.id}`}
            style={styles.item}
            onPress={() => router.push({ pathname: "/analysis/[id]", params: { id: item.id } })}
          >
            <View style={styles.itemTopRow}>
              {item.evidence_verdict?.verdict ? (
                <Badge
                  label={t(`verdict.${item.evidence_verdict.verdict}`)}
                  tone={
                    ({ supported: "olive", contradicted: "error", mixed: "warning", insufficient: "neutral" } as const)[
                      item.evidence_verdict.verdict
                    ]
                  }
                  testID={`history-label-${item.id}`}
                />
              ) : (
                <Badge label={t("history.noVerdict")} tone="neutral" testID={`history-label-${item.id}`} />
              )}
              <Text style={styles.date}>{dayjs(item.created_at).format("lll")}</Text>
            </View>
            <Text style={styles.snippet} numberOfLines={2}>
              {item.source_title || item.input_text.replace(/\s+/g, " ").slice(0, 160)}
            </Text>
            <View style={styles.itemFooter}>
              <Text style={styles.evidenceCount}>
                {t("history.evidenceCount").replace("{count}", String(item.evidence?.length ?? 0))}
              </Text>
              <Pressable
                testID={`history-delete-${item.id}`}
                onPress={() => setDeleteTarget(item)}
                style={styles.deleteButton}
                hitSlop={8}
              >
                <Icon name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          </Pressable>
        )}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.md,
          paddingBottom: (usesNativeTabs ? insets.bottom : 0) + spacing.xl,
        }}
        refreshControl={
          <RefreshControl refreshing={listQuery.isRefetching} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
        }
        ListHeaderComponent={listQuery.isError ? <Text style={styles.loadError}>{t("history.loadFailed")}</Text> : undefined}
        ListEmptyComponent={
          !listQuery.isLoading && !listQuery.isError ? (
            <EmptyState icon="archive-outline" title={t("history.empty")} body={t("history.emptyBody")} />
          ) : undefined
        }
      />
      <Modal transparent visible={exportOpen} animationType="slide" onRequestClose={() => setExportOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.flex} onPress={() => setExportOpen(false)} testID="history-export-backdrop" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="history-export-sheet">
            <Text style={styles.sheetTitle}>{t("history.export")}</Text>
            <AppButton
              label={t("history.exportPdf")}
              loading={exporting === "pdf"}
              disabled={exporting !== null}
              onPress={() => runExport("pdf")}
              testID="history-export-pdf-button"
            />
            <AppButton
              label={t("history.exportCsv")}
              variant="outline"
              loading={exporting === "csv"}
              disabled={exporting !== null}
              onPress={() => runExport("csv")}
              testID="history-export-csv-button"
            />
            <AppButton label={t("common.cancel")} variant="outline" onPress={() => setExportOpen(false)} testID="history-export-cancel-button" />
          </View>
        </View>
      </Modal>
      <ConfirmSheet
        visible={Boolean(deleteTarget)}
        title={t("history.deleteTitle")}
        body={t("history.deleteBody")}
        confirmLabel={t("common.delete")}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        testIDPrefix="history-delete"
      />
      <ConfirmSheet
        visible={confirmClear}
        title={t("history.clearTitle")}
        body={t("history.clearBody")}
        confirmLabel={t("history.clearAll")}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => clearMutation.mutate()}
        testIDPrefix="history-clear"
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerAction: { minHeight: 44, minWidth: 44, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center" },
  exportLink: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.onSurface, textDecorationLine: "underline" },
  backdrop: { flex: 1, backgroundColor: "rgba(44, 42, 41, 0.4)", justifyContent: "flex-end" },
  flex: { flex: 1 },
  sheet: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  sheetTitle: { fontFamily: fonts.extraBold, fontSize: fontSizes.lg, color: colors.onSurface, marginBottom: spacing.sm },
  clearAll: { fontFamily: fonts.semiBold, fontSize: fontSizes.sm, color: colors.error, textDecorationLine: "underline" },
  item: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  date: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  snippet: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.onSurface, lineHeight: 20 },
  itemFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  evidenceCount: { fontFamily: fonts.regular, fontSize: fontSizes.sm, color: colors.muted },
  deleteButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  loadError: { fontFamily: fonts.semiBold, fontSize: fontSizes.base, color: colors.error, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
}));
