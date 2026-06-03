import type { TFile } from "obsidian";
import type {
  IForgottenNotePicker,
  IForgottenNoteInfo,
  IVaultReader,
  IDataPersistence,
  IPluginData,
  IPluginSettings,
} from "../interfaces";
import { PICK_INTERVAL_MS } from "../constants";

export class ForgottenNotePicker implements IForgottenNotePicker {
  private readonly vault: IVaultReader;
  private readonly persistence: IDataPersistence;
  private settings: IPluginSettings;

  constructor(
    vault: IVaultReader,
    persistence: IDataPersistence,
    settings: IPluginSettings,
  ) {
    this.vault = vault;
    this.persistence = persistence;
    this.settings = settings;
  }

  public updateSettings(settings: IPluginSettings): void {
    this.settings = settings;
  }

  public async pick(): Promise<IForgottenNoteInfo | null> {
    const data = (await this.persistence.loadData()) ?? {};
    const visits = data.visits ?? {};
    const now = Date.now();

    const intervalMs = this.getRotationIntervalMs();
    const cached = this.getCachedPick(data, now, intervalMs, visits);
    if (cached !== null) {
      return cached;
    }

    const useRotation = this.settings.forgottenNoteRotationMinutes > 0;
    const candidate = useRotation
      ? this.selectNextForgotten(data.lastPickPath, visits)
      : this.selectRandomForgotten(visits);
    if (candidate === null) {
      return null;
    }

    const newData: IPluginData = {
      lastPickTime: now,
      lastPickPath: candidate.path,
    };
    await this.persistence.saveData(newData);

    return this.buildNoteInfo(candidate, visits);
  }

  public getRotationIntervalMs(): number {
    const minutes = this.settings.forgottenNoteRotationMinutes;
    return minutes > 0 ? minutes * 60 * 1_000 : PICK_INTERVAL_MS;
  }

  private getCachedPick(
    data: IPluginData,
    now: number,
    intervalMs: number,
    visits: Record<string, string>,
  ): IForgottenNoteInfo | null {
    if (data.lastPickTime === undefined || data.lastPickPath === undefined) {
      return null;
    }

    if (now - data.lastPickTime < intervalMs) {
      const file = this.vault.getAbstractFileByPath(data.lastPickPath);
      if (file !== null) {
        return this.buildNoteInfo(file, visits);
      }
    }

    return null;
  }

  public async pickMultiple(count: number): Promise<IForgottenNoteInfo[]> {
    const data = (await this.persistence.loadData()) ?? {};
    const visits = data.visits ?? {};
    const candidates = this.getForgottenCandidates(visits);

    if (candidates.length === 0) {
      return [];
    }

    const selected = new Set<number>();
    const max = Math.min(count, candidates.length);
    while (selected.size < max) {
      selected.add(Math.floor(Math.random() * candidates.length));
    }

    return Array.from(selected).map((i) => this.buildNoteInfo(candidates[i]!, visits));
  }

  private getForgottenCandidates(visits: Record<string, string>): TFile[] {
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
      if (this.isForgotten(file, threshold, visits)) {
        candidates.push(file);
      }
    }

    return candidates;
  }

  private sortCandidatesByForgottenness(candidates: TFile[], visits: Record<string, string>): void {
    candidates.sort((a, b) => {
      const visitA = this.readLastVisitFromData(a, visits);
      const visitB = this.readLastVisitFromData(b, visits);
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
  }

  private selectNextForgotten(previousPath: string | undefined, visits: Record<string, string>): TFile | null {
    const candidates = this.getForgottenCandidates(visits);

    if (candidates.length === 0) {
      return null;
    }

    this.sortCandidatesByForgottenness(candidates, visits);

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

  private selectRandomForgotten(visits: Record<string, string>): TFile | null {
    const candidates = this.getForgottenCandidates(visits);

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

  private isForgotten(file: TFile, threshold: Date, visits: Record<string, string>): boolean {
    const lastVisit = visits[file.path];
    if (lastVisit === undefined) {
      return true;
    }

    const lastVisitDate = new Date(lastVisit);
    if (Number.isNaN(lastVisitDate.getTime())) {
      return true;
    }

    return lastVisitDate < threshold;
  }

  private buildNoteInfo(file: TFile, visits: Record<string, string>): IForgottenNoteInfo {
    const lastVisit = this.readLastVisitFromData(file, visits);
    let daysAgo: number | null = null;
    if (lastVisit !== null) {
      const d = new Date(lastVisit);
      if (!Number.isNaN(d.getTime())) {
        daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      path: file.path,
      name: file.basename,
      lastVisit,
      daysAgo,
    };
  }

  private readLastVisitFromData(file: TFile, visits: Record<string, string>): string | null {
    return visits[file.path] ?? null;
  }
}
