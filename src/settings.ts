import { PluginSettingTab, Setting, TextAreaComponent } from "obsidian";
import type DateTrackerPlugin from "./plugin";

function setupTextareaBelow(setting: Setting, textarea: TextAreaComponent): void {
  textarea.inputEl.style.width = "100%";
  textarea.inputEl.style.minHeight = "80px";
  setting.settingEl.style.flexDirection = "column";
  setting.infoEl.style.width = "100%";
  setting.controlEl.style.width = "100%";
}

export class DateTrackerSettingTab extends PluginSettingTab {
  private readonly plugin: DateTrackerPlugin;

  constructor(plugin: DateTrackerPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  public override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Дней без посещения")
      .setDesc("Через сколько дней без открытия заметка считается «забытой»")
      .addText((text) =>
        text
          .setPlaceholder("15")
          .setValue(String(this.plugin.pluginSettings.forgottenDaysThreshold))
          .onChange(async (value) => {
            const num = Number(value);
            if (!Number.isNaN(num) && num > 0 && Number.isInteger(num)) {
              this.plugin.pluginSettings = {
                ...this.plugin.pluginSettings,
                forgottenDaysThreshold: num,
              };
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Интервал ротации")
      .setDesc(
        "Каждые N минут забытая заметка сменяется на следующую — от самой забытой к недавно посещённой. 0 = случайный выбор.",
      )
      .addText((text) =>
        text
          .setPlaceholder("10")
          .setValue(String(this.plugin.pluginSettings.forgottenNoteRotationMinutes))
          .onChange(async (value) => {
            const num = Number(value);
            if (!Number.isNaN(num) && num >= 0 && Number.isInteger(num)) {
              this.plugin.pluginSettings = {
                ...this.plugin.pluginSettings,
                forgottenNoteRotationMinutes: num,
              };
              await this.plugin.saveSettings();
            }
          }),
      );

    const excludedSetting = new Setting(containerEl)
      .setName("Исключённые пути")
      .setDesc(
        "Регулярные выражения (каждое с новой строки). Заметки, чей путь совпадает с любым из правил, не учитываются.",
      );

    const excludedTextarea = new TextAreaComponent(excludedSetting.controlEl);
    excludedTextarea
      .setPlaceholder("\\.obsidian/\nшаблоны/")
      .setValue(this.plugin.pluginSettings.excludedPaths.join("\n"))
      .onChange(async (value) => {
        const paths = value.split("\n").filter((l) => l.trim().length > 0);
        this.plugin.pluginSettings = {
          ...this.plugin.pluginSettings,
          excludedPaths: paths,
        };
        await this.plugin.saveSettings();
      });
    setupTextareaBelow(excludedSetting, excludedTextarea);

    const includedSetting = new Setting(containerEl)
      .setName("Включённые пути")
      .setDesc(
        "Регулярные выражения (каждое с новой строки). Если не пусто — учитываются ТОЛЬКО заметки, чей путь совпадает хотя бы с одним правилом.",
      );

    const includedTextarea = new TextAreaComponent(includedSetting.controlEl);
    includedTextarea
      .setPlaceholder("дневник/\nпроекты/")
      .setValue(this.plugin.pluginSettings.includedPaths.join("\n"))
      .onChange(async (value) => {
        const paths = value.split("\n").filter((l) => l.trim().length > 0);
        this.plugin.pluginSettings = {
          ...this.plugin.pluginSettings,
          includedPaths: paths,
        };
        await this.plugin.saveSettings();
      });
    setupTextareaBelow(includedSetting, includedTextarea);
  }
}
