import { Plugin, Notice, MarkdownRenderChild, App, Platform } from "obsidian";
import { VisitTracker } from "./services/visit-tracker";
import { ForgottenNotePicker } from "./services/forgotten-note-picker";
import { DateTrackerAPI } from "./api";
import { DateTrackerSettingTab } from "./settings";
import type {
  IDataStore,
  IVaultReader,
  IDataPersistence,
  IPluginData,
  IPluginSettings,
  IDateTrackerAPI,
  IForgottenNoteInfo,
} from "./interfaces";
import type { Vault, TFile } from "obsidian";
import { PLUGIN_NAME, API_GLOBAL_KEY, DEFAULT_SETTINGS } from "./constants";

export default class DateTrackerPlugin extends Plugin {
  private visitTracker!: VisitTracker;
  private forgottenNotePicker!: ForgottenNotePicker;
  private api!: DateTrackerAPI;
  public pluginSettings!: IPluginSettings;

  public override async onload(): Promise<void> {
    await this.loadSettings();

    const vault = this.createVaultReader();
    const persistence = this.createPersistence();

    this.visitTracker = new VisitTracker(persistence);
    this.forgottenNotePicker = new ForgottenNotePicker(vault, persistence, this.pluginSettings);
    this.api = new DateTrackerAPI(this.forgottenNotePicker);

    this.addSettingTab(new DateTrackerSettingTab(this));

    this.registerFileOpenHandler();
    this.registerRenameHandler();
    this.exposeAPI();
    this.registerCodeBlockRenderer();
    this.registerInsertCommand();

    console.warn(`${PLUGIN_NAME} loaded`);
  }

  public override onunload(): void {
    this.unexposeAPI();

    console.warn(`${PLUGIN_NAME} unloaded`);
  }

  public async loadSettings(): Promise<void> {
    const store = (await this.loadData()) as IDataStore | undefined;
    const saved = store?.settings as Partial<IPluginSettings> | undefined;
    this.pluginSettings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
  }

  public async saveSettings(): Promise<void> {
    try {
      for (const p of this.pluginSettings.excludedPaths) {
        new RegExp(p);
      }
      for (const p of this.pluginSettings.includedPaths) {
        new RegExp(p);
      }
    } catch (e) {
      new Notice(`Ошибка в regex: ${(e as Error).message}`);
      return;
    }

    if (this.pluginSettings.includedPaths.length > 0 && this.pluginSettings.excludedPaths.length > 0) {
      const files = this.app.vault.getMarkdownFiles();
      const MAX_CHECK = 200;
      const checked = files.slice(0, MAX_CHECK);
      for (const file of checked) {
        const isIncluded = this.pluginSettings.includedPaths.some((p) => new RegExp(p).test(file.path));
        const isExcluded = this.pluginSettings.excludedPaths.some((p) => new RegExp(p).test(file.path));
        if (isIncluded && isExcluded) {
          new Notice(
            `Конфликт: путь "${file.path}" соответствует одновременно включённым и исключённым правилам`,
          );
          return;
        }
      }
    }

    const existing = ((await this.loadData()) ?? {}) as IDataStore;
    await this.saveData({ ...existing, settings: this.pluginSettings } as Record<string, unknown>);
    this.forgottenNotePicker.updateSettings(this.pluginSettings);
  }

  private registerFileOpenHandler(): void {
    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (file === null) return;
        if (file.extension !== "md") return;

        await this.visitTracker.onFileOpened(file);
      }),
    );
  }

  private registerRenameHandler(): void {
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        const mdFile = file as TFile;
        if (mdFile.extension !== "md") return;
        void this.visitTracker.onFileRenamed(oldPath, mdFile.path);
      }),
    );
  }

  private exposeAPI(): void {
    (window as unknown as Record<string, unknown>)[API_GLOBAL_KEY] = this.api;
  }

  private unexposeAPI(): void {
    Reflect.deleteProperty(window, API_GLOBAL_KEY);
  }

  private createVaultReader(): IVaultReader {
    const vault: Vault = this.app.vault;
    return {
      getMarkdownFiles(): TFile[] {
        return vault.getMarkdownFiles();
      },
      async read(file: TFile): Promise<string> {
        return vault.read(file);
      },
      async modify(file: TFile, content: string): Promise<void> {
        return vault.modify(file, content);
      },
      getAbstractFileByPath(path: string): TFile | null {
        const file = vault.getAbstractFileByPath(path);
        if (file === null) return null;
        return file as TFile;
      },
    };
  }

  private createPersistence(): IDataPersistence {
    return {
      loadData: async (): Promise<IPluginData | null> => {
        const store = (await this.loadData()) as IDataStore | null;
        return store?.data ?? null;
      },
      saveData: async (data: IPluginData): Promise<void> => {
        const store = (await this.loadData()) as IDataStore | null;
        const existingData = store?.data ?? {};
        const mergedData = { ...existingData, ...data };
        await this.saveData({ ...store, data: mergedData } as Record<string, unknown>);
      },
    };
  }

  private registerCodeBlockRenderer(): void {
    this.registerMarkdownCodeBlockProcessor("forgotten-notes", (_source, el, ctx) => {
      const child = new ForgottenNotesRenderChild(el, this.app, this.api, () => this.pluginSettings);
      ctx.addChild(child);
    });
  }

  private registerInsertCommand(): void {
    this.addCommand({
      id: "insert-forgotten-notes-block",
      name: "Вставить блок забытых заметок",
      editorCallback: (editor): void => {
        editor.replaceSelection("```forgotten-notes\n```\n");
      },
    });
  }
}

class ForgottenNotesRenderChild extends MarkdownRenderChild {
  private intervalId: number | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly app: App,
    private readonly api: IDateTrackerAPI,
    private readonly getSettings: () => IPluginSettings,
  ) {
    super(containerEl);
  }

  public override onload(): void {
    void this.render();

    const intervalMs = this.api.getRotationIntervalMs();
    this.intervalId = window.setInterval(() => {
      if (!this.containerEl.isConnected) return;
      void this.render();
    }, intervalMs);
  }

  public override onunload(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async render(): Promise<void> {
    const container = this.containerEl;
    container.empty();
    container.style.width = "100%";

    const settings = this.getSettings();

    const scale = Math.max(0.7, 1 - (settings.notesToShow - 1) * 0.1);

    if (settings.notesToShow <= 1) {
      container.style.cssText +=
        "padding:10px;border-radius:8px;background-color:rgba(128,128,128,0.05);border:1px solid rgba(128,128,128,0.2);display:flex;align-items:center;gap:12px;";

      const note = await this.api.getForgottenNote();
      if (note === null) {
        container.innerHTML = `<span style="opacity:0.6;">✨ Все заметки недавно посещались</span>`;
        return;
      }
      this.renderNoteContent(container, note, scale, settings.displayPathSegments);
    } else {
      container.style.display = "grid";
      container.style.gridTemplateColumns = Platform.isMobile ? "1fr" : "repeat(auto-fill, minmax(160px, 1fr))";
      container.style.gap = "12px";

      const notes = await this.api.getForgottenNotes(settings.notesToShow);
      if (notes.length === 0) {
        container.innerHTML = `<span style="opacity:0.6;">✨ Все заметки недавно посещались</span>`;
        return;
      }

      for (const note of notes) {
        const cardEl = container.createEl("div");
        cardEl.style.cssText =
          "padding:10px;border-radius:8px;background-color:rgba(128,128,128,0.05);border:1px solid rgba(128,128,128,0.2);display:flex;align-items:center;gap:12px;";
        this.renderNoteContent(cardEl, note, scale, settings.displayPathSegments);
      }
    }
  }

  private renderNoteContent(containerEl: HTMLElement, note: IForgottenNoteInfo, scale: number, displayPathSegments: number): void {
    containerEl.style.fontSize = `${String(scale)}em`;
    containerEl.createEl("span", { text: "💭", attr: { style: "font-size:1.5em;" } });

    const textWrapper = containerEl.createEl("div");
    textWrapper.style.flex = "1";

    const segments = note.path.replace(/\.md$/, "").split("/");
    const displayPath = segments.slice(-displayPathSegments).join("/");

    const linkEl = textWrapper.createEl("span", { text: displayPath });
    linkEl.style.cssText = "color:var(--link-color);cursor:pointer;font-weight:600;";
    linkEl.className = "internal-link";
    linkEl.setAttribute("data-href", note.path);
    linkEl.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      void this.app.workspace.openLinkText(note.path, "", true);
    });

    if (note.daysAgo !== null) {
      textWrapper.createEl("div", {
        text: `Не посещалось ${String(note.daysAgo)} дней`,
        attr: { style: "font-size:0.85em;opacity:0.5;margin-top:2px;" },
      });
    } else {
      textWrapper.createEl("div", {
        text: "Ни разу не открывалась",
        attr: { style: "font-size:0.85em;opacity:0.5;margin-top:2px;" },
      });
    }
  }
}
