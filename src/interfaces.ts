import type { TFile } from "obsidian";

export interface IPluginSettings {
  readonly forgottenDaysThreshold: number;
  readonly forgottenNoteRotationMinutes: number;
  readonly excludedPaths: readonly string[];
  readonly includedPaths: readonly string[];
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
}

export interface IForgottenNotePicker {
  pick(): Promise<IForgottenNoteInfo | null>;
}

export interface IDateTrackerAPI {
  getForgottenNote(): Promise<IForgottenNoteInfo | null>;
  getRotationIntervalMs(): number;
}

export type FrontmatterEditResult =
  | { readonly kind: "updated"; readonly content: string }
  | { readonly kind: "unchanged" };
