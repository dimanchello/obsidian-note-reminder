import type { TFile } from "obsidian";
import type { IVisitTracker, IMetadataReader, IVaultReader } from "../interfaces";
import { FrontmatterEditor } from "./frontmatter-editor";

export class VisitTracker implements IVisitTracker {
  private readonly editor: FrontmatterEditor;
  private readonly metadata: IMetadataReader;
  private readonly vault: IVaultReader;

  constructor(editor: FrontmatterEditor, metadata: IMetadataReader, vault: IVaultReader) {
    this.editor = editor;
    this.metadata = metadata;
    this.vault = vault;
  }

  public async onFileOpened(file: TFile): Promise<void> {
    const today = this.getTodayStr();

    const cachedFrontmatter = this.metadata.getFileCache(file)?.frontmatter;
    if (cachedFrontmatter !== undefined) {
      const cachedValue = cachedFrontmatter[DATE_LAST_VISIT_FIELD];
      if (typeof cachedValue === "string" && cachedValue === today) {
        return;
      }
    }

    const content = await this.vault.read(file);
    const result = this.editor.updateLastVisit(content, today);

    if (result.kind === "updated") {
      await this.vault.modify(file, result.content);
    }
  }

  private getTodayStr(): string {
    const now = new Date();
    return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
}

const DATE_LAST_VISIT_FIELD = "date_last_visit";
