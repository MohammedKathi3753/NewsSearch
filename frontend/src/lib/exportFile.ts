import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { API_BASE } from "./api";
import { supabase } from "./supabase";

export type ExportFormat = "csv" | "pdf";

const MIME: Record<ExportFormat, string> = { csv: "text/csv", pdf: "application/pdf" };

/** Downloads the signed-in user's history from the API and saves/shares it. */
export async function exportHistory(format: ExportFormat) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to export your history.");
  const url = `${API_BASE}/export?format=${format}`;
  const filename = `newssearch-history.${format}`;

  if (Platform.OS === "web") {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Export failed (${response.status}).`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    return;
  }

  const destination = new File(Paths.cache, filename);
  const file = await File.downloadFileAsync(url, destination, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: MIME[format], dialogTitle: filename });
  }
}
