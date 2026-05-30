import { Plugin, Notice } from "obsidian";
import { FrontmatterEditor } from "./services/frontmatter-editor";
import { VisitTracker } from "./services/visit-tracker";
import { ForgottenNotePicker } from "./services/forgotten-note-picker";
import { DateTrackerAPI } from "./api";
import { DateTrackerSettingTab } from "./settings";
import type {
  IDataStore,
  IMetadataReader,
  IVaultReader,
  IDataPersistence,
  IFrontmatterCache,
  IPluginData,
  IPluginSettings,
} from "./interfaces";
import type { Vault, MetadataCache, TFile } from "obsidian";
import { PLUGIN_NAME, API_GLOBAL_KEY, DEFAULT_SETTINGS } from "./constants";

export default class DateTrackerPlugin extends Plugin {
  private visitTracker!: VisitTracker;
  private forgottenNotePicker!: ForgottenNotePicker;
  private api!: DateTrackerAPI;
  public pluginSettings!: IPluginSettings;

  public override async onload(): Promise<void> {
    await this.loadSettings();

    const editor = new FrontmatterEditor();
    const metadata = this.createMetadataReader();
    const vault = this.createVaultReader();
    const persistence = this.createPersistence();

    this.visitTracker = new VisitTracker(editor, metadata, vault);
    this.forgottenNotePicker = new ForgottenNotePicker(metadata, vault, persistence, this.pluginSettings);
    this.api = new DateTrackerAPI(this.forgottenNotePicker);

    this.addSettingTab(new DateTrackerSettingTab(this));

    this.registerFileOpenHandler();
    this.exposeAPI();

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

  private exposeAPI(): void {
    (window as unknown as Record<string, unknown>)[API_GLOBAL_KEY] = this.api;
  }

  private unexposeAPI(): void {
    Reflect.deleteProperty(window, API_GLOBAL_KEY);
  }

  private createMetadataReader(): IMetadataReader {
    const cache: MetadataCache = this.app.metadataCache;
    return {
      getFileCache(file: TFile): IFrontmatterCache | null {
        return cache.getFileCache(file);
      },
    };
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
        const existing = ((await this.loadData()) ?? {}) as IDataStore;
        await this.saveData({ ...existing, data } as Record<string, unknown>);
      },
    };
  }
}
