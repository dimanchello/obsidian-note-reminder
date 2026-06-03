import type { TFile } from "obsidian";
import { ForgottenNotePicker } from "../../src/services/forgotten-note-picker";
import type {
  IVaultReader,
  IDataPersistence,
  IPluginData,
  IPluginSettings,
} from "../../src/interfaces";
import { PICK_INTERVAL_MS } from "../../src/constants";

function createSettingsMock(overrides?: Partial<IPluginSettings>): IPluginSettings {
  return {
    forgottenDaysThreshold: 15,
    forgottenNoteRotationMinutes: 10,
    excludedPaths: [],
    includedPaths: [],
    displayPathSegments: 2,
    notesToShow: 1,
    ...overrides,
  };
}

function createMockFile(path: string, basename: string): TFile {
  return {
    path,
    basename,
    name: basename + ".md",
    extension: "md",
    parent: null,
    vault: null as never,
  } as TFile;
}

function createVaultMock(files: TFile[]): IVaultReader {
  return {
    getMarkdownFiles: jest.fn().mockReturnValue(files),
    read: jest.fn().mockResolvedValue(""),
    modify: jest.fn().mockResolvedValue(undefined),
    getAbstractFileByPath: jest.fn().mockImplementation((path: string) => {
      return files.find((f) => f.path === path) ?? null;
    }),
  };
}

function createPersistenceMock(initialData: IPluginData | null): IDataPersistence {
  let data = initialData;
  return {
    loadData: jest.fn().mockImplementation(() => Promise.resolve(data ? { ...data } : null)),
    saveData: jest.fn().mockImplementation((newData: IPluginData) => {
      data = { ...(data ?? {}), ...newData };
      return Promise.resolve();
    }),
  };
}

describe("ForgottenNotePicker", () => {
  let vault: IVaultReader;
  let persistence: IDataPersistence;
  let settings: IPluginSettings;
  let picker: ForgottenNotePicker;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-30T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null when no candidates exist", async () => {
    const file = createMockFile("note.md", "note");
    vault = createVaultMock([file]);
    persistence = createPersistenceMock({
      visits: { "note.md": "2026-05-30" },
    });
    settings = createSettingsMock({ forgottenDaysThreshold: 15 });
    picker = new ForgottenNotePicker(vault, persistence, settings);

    const result = await picker.pick();

    expect(result).toBeNull();
  });

  it("returns a note without visit entry as candidate", async () => {
    const file = createMockFile("note.md", "note");
    vault = createVaultMock([file]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock();
    picker = new ForgottenNotePicker(vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(result?.path).toBe("note.md");
  });

  it("returns a note with old visit date as candidate", async () => {
    const file = createMockFile("note.md", "note");
    vault = createVaultMock([file]);
    persistence = createPersistenceMock({
      visits: { "note.md": "2025-01-01" },
    });
    settings = createSettingsMock({ forgottenDaysThreshold: 15 });
    picker = new ForgottenNotePicker(vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(result?.path).toBe("note.md");
    expect(result?.daysAgo).toBeGreaterThan(15);
  });

  it("skips excluded paths via regex", async () => {
    const obsidianFile = createMockFile(".obsidian/config.md", "config");
    const templateFile = createMockFile("шаблоны/template.md", "template");
    const goodFile = createMockFile("note.md", "note");
    vault = createVaultMock([obsidianFile, templateFile, goodFile]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock({ excludedPaths: ["\\.obsidian/", "шаблоны/"] });
    picker = new ForgottenNotePicker(vault, persistence, settings);

    const result = await picker.pick();

    expect(result?.path).toBe("note.md");
  });

  it("respects included paths filter", async () => {
    const excludedFile = createMockFile("archive/old.md", "old");
    const includedFile = createMockFile("daily/2026-05-30.md", "2026-05-30");
    vault = createVaultMock([excludedFile, includedFile]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock({ includedPaths: ["daily/"] });
    picker = new ForgottenNotePicker(vault, persistence, settings);

    const result = await picker.pick();

    expect(result?.path).toBe("daily/2026-05-30.md");
  });

  it("returns cached pick within interval", async () => {
    const file = createMockFile("note.md", "note");
    const oldNote = createMockFile("old.md", "old");
    vault = createVaultMock([file, oldNote]);
    persistence = createPersistenceMock({
      lastPickTime: Date.now(),
      lastPickPath: "note.md",
      visits: { "note.md": undefined },
    });
    settings = createSettingsMock();
    picker = new ForgottenNotePicker(vault, persistence, settings);

    const result = await picker.pick();

    expect(result?.path).toBe("note.md");
  });

  it("picks a new note after interval passes", async () => {
    const file = createMockFile("note.md", "note");
    vault = createVaultMock([file]);
    persistence = createPersistenceMock({
      lastPickTime: Date.now() - PICK_INTERVAL_MS - 1,
      lastPickPath: "old.md",
    });
    settings = createSettingsMock();
    picker = new ForgottenNotePicker(vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(persistence.saveData).toHaveBeenCalled();
  });

  it("builds correct info with daysAgo", async () => {
    const file = createMockFile("note.md", "note");
    vault = createVaultMock([file]);
    persistence = createPersistenceMock({
      visits: { "note.md": "2026-05-01" },
    });
    settings = createSettingsMock({ forgottenDaysThreshold: 15 });
    picker = new ForgottenNotePicker(vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(result?.name).toBe("note");
    expect(result?.lastVisit).toBe("2026-05-01");
    expect(result?.daysAgo).toBe(29);
  });

  describe("pickMultiple", () => {
    it("returns empty array when no candidates exist", async () => {
      const file = createMockFile("note.md", "note");
      vault = createVaultMock([file]);
      persistence = createPersistenceMock({
        visits: { "note.md": "2026-05-30" },
      });
      settings = createSettingsMock({ forgottenDaysThreshold: 15 });
      picker = new ForgottenNotePicker(vault, persistence, settings);

      const result = await picker.pickMultiple(3);

      expect(result).toEqual([]);
    });

    it("returns N random notes from forgotten candidates", async () => {
      const files = [
        createMockFile("a.md", "a"),
        createMockFile("b.md", "b"),
        createMockFile("c.md", "c"),
        createMockFile("d.md", "d"),
        createMockFile("e.md", "e"),
      ];
      vault = createVaultMock(files);
      persistence = createPersistenceMock(null);
      settings = createSettingsMock({ forgottenDaysThreshold: 15 });
      picker = new ForgottenNotePicker(vault, persistence, settings);

      const result = await picker.pickMultiple(3);

      expect(result).toHaveLength(3);
      const allPaths = files.map((f) => f.path);
      for (const note of result) {
        expect(allPaths).toContain(note.path);
      }
      const paths = result.map((n) => n.path);
      expect(new Set(paths).size).toBe(paths.length);
    });

    it("returns fewer notes when count exceeds candidate pool", async () => {
      const file = createMockFile("note.md", "note");
      vault = createVaultMock([file]);
      persistence = createPersistenceMock(null);
      settings = createSettingsMock({ forgottenDaysThreshold: 15 });
      picker = new ForgottenNotePicker(vault, persistence, settings);

      const result = await picker.pickMultiple(5);

      expect(result).toHaveLength(1);
      expect(result[0]?.path).toBe("note.md");
    });
  });

  describe("rotation mode", () => {
    it("returns the most forgotten note first", async () => {
      const recentFile = createMockFile("recent.md", "recent");
      const oldFile = createMockFile("old.md", "old");
      const oldestFile = createMockFile("oldest.md", "oldest");
      vault = createVaultMock([recentFile, oldFile, oldestFile]);
      persistence = createPersistenceMock({
        visits: {
          "oldest.md": "2025-01-01",
          "old.md": "2025-06-01",
          "recent.md": "2026-05-01",
        },
      });
      settings = createSettingsMock({ forgottenDaysThreshold: 15, forgottenNoteRotationMinutes: 10 });
      picker = new ForgottenNotePicker(vault, persistence, settings);

      const first = await picker.pick();

      expect(first?.path).toBe("oldest.md");
    });

    it("cycles to next forgotten note after interval", async () => {
      const recentFile = createMockFile("recent.md", "recent");
      const oldFile = createMockFile("old.md", "old");
      const oldestFile = createMockFile("oldest.md", "oldest");
      vault = createVaultMock([recentFile, oldFile, oldestFile]);
      persistence = createPersistenceMock({
        visits: {
          "oldest.md": "2025-01-01",
          "old.md": "2025-06-01",
          "recent.md": "2026-05-01",
        },
      });
      settings = createSettingsMock({ forgottenDaysThreshold: 15, forgottenNoteRotationMinutes: 10 });
      picker = new ForgottenNotePicker(vault, persistence, settings);

      await picker.pick();
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);

      const second = await picker.pick();

      expect(second?.path).toBe("old.md");
    });

    it("wraps around to the first note after cycling through all", async () => {
      const file1 = createMockFile("a.md", "a");
      const file2 = createMockFile("b.md", "b");
      vault = createVaultMock([file1, file2]);
      persistence = createPersistenceMock({
        visits: {
          "a.md": "2025-01-01",
          "b.md": "2025-06-01",
        },
      });
      settings = createSettingsMock({ forgottenDaysThreshold: 15, forgottenNoteRotationMinutes: 10 });
      picker = new ForgottenNotePicker(vault, persistence, settings);

      await picker.pick();
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);
      await picker.pick();
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);

      const third = await picker.pick();

      expect(third?.path).toBe("a.md");
    });

    it("null lastVisit (no visit data) sorts before dated notes", async () => {
      const datedFile = createMockFile("dated.md", "dated");
      const noVisitFile = createMockFile("nofront.md", "nofront");
      vault = createVaultMock([datedFile, noVisitFile]);
      persistence = createPersistenceMock({
        visits: {
          "dated.md": "2025-01-01",
        },
      });
      settings = createSettingsMock({ forgottenDaysThreshold: 15, forgottenNoteRotationMinutes: 10 });
      picker = new ForgottenNotePicker(vault, persistence, settings);

      const first = await picker.pick();

      expect(first?.path).toBe("nofront.md");
    });

    it("falls back to random selection when rotation is 0", async () => {
      const file = createMockFile("note.md", "note");
      vault = createVaultMock([file]);
      persistence = createPersistenceMock(null);
      settings = createSettingsMock({ forgottenNoteRotationMinutes: 0 });
      picker = new ForgottenNotePicker(vault, persistence, settings);

      const result = await picker.pick();

      expect(result?.path).toBe("note.md");
    });
  });
});
