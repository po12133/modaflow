export interface BackupItem {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  source: "CREATED" | "IMPORTED";
  sizeBytes: number | null;
  databaseBytes: number | null;
  fileCount: number | null;
  filesBytes: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  downloadable: boolean;
  createdBy: { name: string; email: string };
}

export interface BackupsView {
  ready: { database: boolean; encryption: boolean; storage: boolean };
  items: BackupItem[];
}
