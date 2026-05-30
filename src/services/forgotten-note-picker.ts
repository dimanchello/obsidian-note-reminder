import type { TFile } from "obsidian";
import type {
  IForgottenNotePicker,
  IForgottenNoteInfo,
  IMetadataReader,
  IVaultReader,
  IDataPersistence,
  IPluginData,
  IPluginSettings,
} from "../interfaces";
import { PICK_INTERVAL_MS } from "../constants";
import { FrontmatterEditor } from "./frontmatter-editor";

export class ForgottenNotePicker implements IForgottenNotePicker {
  private readonly metadata: IMetadataReader;
  private readonly vault: IVaultReader;
  private readonly persistence: IDataPersistence;
  private settings: IPluginSettings;

  constructor(
    metadata: IMetadataReader,
    vault: IVaultReader,
    persistence: IDataPersistence,
    settings: IPluginSettings,
  ) {
    this.metadata = metadata;
    this.vault = vault;
    this.persistence = persistence;
    this.settings = settings;
  }

  public updateSettings(settings: IPluginSettings): void {
    this.settings = settings;
  }

  public async pick(): Promise<IForgottenNoteInfo | null> {
    const data = (await this.persistence.loadData()) ?? {};
    const now = Date.now();

    const intervalMs = this.getRotationIntervalMs();
    const cached = this.getCachedPick(data, now, intervalMs);
    if (cached !== null) {
      return cached;
    }

    const useRotation = this.settings.forgottenNoteRotationMinutes > 0;
    const candidate = useRotation
      ? this.selectNextForgotten(data.lastPickPath)
      : this.selectRandomForgotten();
    if (candidate === null) {
      return null;
    }

    const newData: IPluginData = {
      lastPickTime: now,
      lastPickPath: candidate.path,
    };
    await this.persistence.saveData(newData);

    return this.buildNoteInfo(candidate);
  }

  public getRotationIntervalMs(): number {
    const minutes = this.settings.forgottenNoteRotationMinutes;
    return minutes > 0 ? minutes * 60 * 1_000 : PICK_INTERVAL_MS;
  }

  private getCachedPick(data: IPluginData, now: number, intervalMs: number): IForgottenNoteInfo | null {
    if (data.lastPickTime === undefined || data.lastPickPath === undefined) {
      return null;
    }

    if (now - data.lastPickTime < intervalMs) {
      const file = this.vault.getAbstractFileByPath(data.lastPickPath);
      if (file !== null) {
        return this.buildNoteInfo(file);
      }
    }

    return null;
  }

  private selectNextForgotten(previousPath: string | undefined): TFile | null {
    const files = this.vault.getMarkdownFiles();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - this.settings.forgottenDaysThreshold);

    const candidates: TFile[] = [];

    for (const file of files) {
      if (!this.isIncluded(file.path)) {
        continue;
      }
      if (this.isExcluded(file.path)) {
        continue;
      }
      if (this.isForgotten(file, threshold)) {
        candidates.push(file);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => {
      const visitA = this.readLastVisitFromCache(a);
      const visitB = this.readLastVisitFromCache(b);
      if (visitA === null && visitB === null) {
        return a.path.localeCompare(b.path);
      }
      if (visitA === null) {
        return -1;
      }
      if (visitB === null) {
        return 1;
      }
      const cmp = visitA.localeCompare(visitB);
      if (cmp !== 0) {
        return cmp;
      }
      return a.path.localeCompare(b.path);
    });

    if (previousPath === undefined) {
      return candidates[0] ?? null;
    }

    const prevIndex = candidates.findIndex((f) => f.path === previousPath);
    if (prevIndex === -1) {
      return candidates[0] ?? null;
    }

    const nextIndex = (prevIndex + 1) % candidates.length;
    return candidates[nextIndex] ?? null;
  }

  private selectRandomForgotten(): TFile | null {
    const files = this.vault.getMarkdownFiles();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - this.settings.forgottenDaysThreshold);

    const candidates: TFile[] = [];

    for (const file of files) {
      if (!this.isIncluded(file.path)) {
        continue;
      }
      if (this.isExcluded(file.path)) {
        continue;
      }
      if (this.isForgotten(file, threshold)) {
        candidates.push(file);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index] ?? null;
  }

  private isIncluded(filePath: string): boolean {
    if (this.settings.includedPaths.length === 0) {
      return true;
    }
    return this.matchesAny(filePath, this.settings.includedPaths);
  }

  private isExcluded(filePath: string): boolean {
    return this.matchesAny(filePath, this.settings.excludedPaths);
  }

  private matchesAny(filePath: string, patterns: readonly string[]): boolean {
    return patterns.some((pattern) => new RegExp(pattern).test(filePath));
  }

  private isForgotten(file: TFile, threshold: Date): boolean {
    const cache = this.metadata.getFileCache(file);

    if (cache?.frontmatter === undefined) {
      return true;
    }

    const lastVisit = cache.frontmatter[DATE_LAST_VISIT_FIELD];
    if (lastVisit === undefined || lastVisit === null) {
      return true;
    }

    if (typeof lastVisit !== "string") {
      return true;
    }

    const lastVisitDate = new Date(lastVisit);
    if (Number.isNaN(lastVisitDate.getTime())) {
      return true;
    }

    return lastVisitDate < threshold;
  }

  private buildNoteInfo(file: TFile): IForgottenNoteInfo {
    const lastVisit = this.readLastVisitFromCache(file);
    const daysAgo = FrontmatterEditor.daysAgo(lastVisit);

    return {
      path: file.path,
      name: file.basename,
      lastVisit,
      daysAgo,
    };
  }

  private readLastVisitFromCache(file: TFile): string | null {
    const cache = this.metadata.getFileCache(file);

    if (cache?.frontmatter === undefined) {
      return null;
    }

    const value = cache.frontmatter[DATE_LAST_VISIT_FIELD];
    if (typeof value !== "string") {
      return null;
    }

    return value;
  }
}

const DATE_LAST_VISIT_FIELD = "date_last_visit";
