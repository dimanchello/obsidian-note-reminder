import type { IPluginSettings } from "./interfaces";

export const PICK_INTERVAL_MS = 10 * 60 * 1_000;
export const DATE_LAST_VISIT_FIELD = "date_last_visit";
export const PLUGIN_NAME = "Date Tracker";
export const PLUGIN_ID = "date-tracker";
export const API_GLOBAL_KEY = "__dateTracker";

export const DEFAULT_SETTINGS: IPluginSettings = {
  forgottenDaysThreshold: 15,
  forgottenNoteRotationMinutes: 10,
  excludedPaths: [".obsidian/", "шаблоны/"],
  includedPaths: [],
  displayPathSegments: 2,
  notesToShow: 1,
};
