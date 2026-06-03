import type { TFile } from "obsidian";
import type { IVisitTracker, IDataPersistence } from "../interfaces";

export class VisitTracker implements IVisitTracker {
  private readonly persistence: IDataPersistence;

  constructor(persistence: IDataPersistence) {
    this.persistence = persistence;
  }

  public async onFileOpened(file: TFile): Promise<void> {
    const today = this.getTodayStr();

    const data = (await this.persistence.loadData()) ?? {};
    const visits = data.visits ?? {};

    if (visits[file.path] === today) {
      return;
    }

    visits[file.path] = today;
    await this.persistence.saveData({ ...data, visits });
  }

  public async onFileRenamed(oldPath: string, newPath: string): Promise<void> {
    const data = (await this.persistence.loadData()) ?? {};
    const visits = data.visits ?? {};

    if (oldPath in visits) {
      visits[newPath] = visits[oldPath]!;
      Reflect.deleteProperty(visits, oldPath);
      await this.persistence.saveData({ ...data, visits });
    }
  }

  private getTodayStr(): string {
    const now = new Date();
    return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
}
