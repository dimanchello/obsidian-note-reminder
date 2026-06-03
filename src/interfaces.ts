import type { TFile } from "obsidian";

export interface IPluginSettings {
  readonly forgottenDaysThreshold: number;
  readonly forgottenNoteRotationMinutes: number;
  readonly excludedPaths: readonly string[];
  readonly includedPaths: readonly string[];
  readonly displayPathSegments: number;
  readonly notesToShow: number;
}

export interface IForgottenNoteInfo {
  readonly path: string;
  readonly name: string;
  readonly lastVisit: string | null;
  readonly daysAgo: number | null;
}

export interface IPluginData {
  readonly lastPickTime?: number;
  readonly lastPickPath?: string;
  readonly visits?: Record<string, string>;
}

export interface IDataStore {
  readonly settings?: IPluginSettings;
  readonly data?: IPluginData;
}

export interface IDataPersistence {
  loadData(): Promise<IPluginData | null>;
  saveData(data: IPluginData): Promise<void>;
}

export interface IVaultReader {
  getMarkdownFiles(): TFile[];
  read(file: TFile): Promise<string>;
  modify(file: TFile, content: string): Promise<void>;
  getAbstractFileByPath(path: string): TFile | null;
}

export interface IMetadataReader {
  getFileCache(file: TFile): IFrontmatterCache | null;
}

export interface IFrontmatterCache {
  readonly frontmatter?: Record<string, unknown>;
}

export interface IVisitTracker {
  onFileOpened(file: TFile): Promise<void>;
  onFileRenamed(oldPath: string, newPath: string): Promise<void>;
}

export interface IForgottenNotePicker {
  pick(): Promise<IForgottenNoteInfo | null>;
  pickMultiple(count: number): Promise<IForgottenNoteInfo[]>;
}

export interface IDateTrackerAPI {
  getForgottenNote(): Promise<IForgottenNoteInfo | null>;
  getForgottenNotes(count: number): Promise<IForgottenNoteInfo[]>;
  getRotationIntervalMs(): number;
}

export type FrontmatterEditResult =
  | { readonly kind: "updated"; readonly content: string }
  | { readonly kind: "unchanged" };
