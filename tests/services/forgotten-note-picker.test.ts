import type { TFile } from "obsidian";
import { ForgottenNotePicker } from "../../src/services/forgotten-note-picker";
import type {
  IMetadataReader,
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

function createMetadataMock(lastVisits: Map<string, string | undefined>): IMetadataReader {
  return {
    getFileCache: jest.fn().mockImplementation((file: TFile) => {
      const visit = lastVisits.get(file.path);
      if (visit === undefined) {
        return { frontmatter: {} };
      }
      return { frontmatter: { date_last_visit: visit } };
    }),
  };
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
    loadData: jest.fn().mockImplementation(() => Promise.resolve(data)),
    saveData: jest.fn().mockImplementation((newData: IPluginData) => {
      data = newData;
      return Promise.resolve();
    }),
  };
}

describe("ForgottenNotePicker", () => {
  let metadata: IMetadataReader;
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
    const lastVisits = new Map([["note.md", "2026-05-30"]]);
    metadata = createMetadataMock(lastVisits);
    vault = createVaultMock([file]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock({ forgottenDaysThreshold: 15 });
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result).toBeNull();
  });

  it("returns a note without frontmatter as candidate", async () => {
    const file = createMockFile("note.md", "note");
    metadata = createMetadataMock(new Map());
    vault = createVaultMock([file]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock();
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(result?.path).toBe("note.md");
  });

  it("returns a note without date_last_visit field as candidate", async () => {
    const file = createMockFile("note.md", "note");
    const lastVisits = new Map([["note.md", undefined]]);
    metadata = createMetadataMock(lastVisits);
    vault = createVaultMock([file]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock();
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(result?.path).toBe("note.md");
  });

  it("returns a note with old date_last_visit as candidate", async () => {
    const file = createMockFile("note.md", "note");
    const lastVisits = new Map([["note.md", "2025-01-01"]]);
    metadata = createMetadataMock(lastVisits);
    vault = createVaultMock([file]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock({ forgottenDaysThreshold: 15 });
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(result?.path).toBe("note.md");
    expect(result?.daysAgo).toBeGreaterThan(15);
  });

  it("skips excluded paths via regex", async () => {
    const obsidianFile = createMockFile(".obsidian/config.md", "config");
    const templateFile = createMockFile("шаблоны/template.md", "template");
    const goodFile = createMockFile("note.md", "note");
    const lastVisits = new Map([
      [".obsidian/config.md", undefined],
      ["шаблоны/template.md", undefined],
      ["note.md", undefined],
    ]);
    metadata = createMetadataMock(lastVisits);
    vault = createVaultMock([obsidianFile, templateFile, goodFile]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock({ excludedPaths: ["\\.obsidian/", "шаблоны/"] });
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result?.path).toBe("note.md");
  });

  it("respects included paths filter", async () => {
    const excludedFile = createMockFile("archive/old.md", "old");
    const includedFile = createMockFile("daily/2026-05-30.md", "2026-05-30");
    const lastVisits = new Map([
      ["archive/old.md", undefined],
      ["daily/2026-05-30.md", undefined],
    ]);
    metadata = createMetadataMock(lastVisits);
    vault = createVaultMock([excludedFile, includedFile]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock({ includedPaths: ["daily/"] });
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result?.path).toBe("daily/2026-05-30.md");
  });

  it("returns cached pick within 10 minutes", async () => {
    const file = createMockFile("note.md", "note");
    const oldNote = createMockFile("old.md", "old");
    const lastVisits = new Map([
      ["note.md", undefined],
      ["old.md", undefined],
    ]);

    metadata = createMetadataMock(lastVisits);
    vault = createVaultMock([file, oldNote]);
    persistence = createPersistenceMock({
      lastPickTime: Date.now(),
      lastPickPath: "note.md",
    });
    settings = createSettingsMock();
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result?.path).toBe("note.md");
  });

  it("picks a new note after 10 minutes pass", async () => {
    const file = createMockFile("note.md", "note");
    const lastVisits = new Map([["note.md", undefined]]);

    metadata = createMetadataMock(lastVisits);
    vault = createVaultMock([file]);
    persistence = createPersistenceMock({
      lastPickTime: Date.now() - PICK_INTERVAL_MS - 1,
      lastPickPath: "old.md",
    });
    settings = createSettingsMock();
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(persistence.saveData).toHaveBeenCalled();
  });

  it("builds correct info with daysAgo", async () => {
    const file = createMockFile("note.md", "note");
    const lastVisits = new Map([["note.md", "2026-05-01"]]);
    metadata = createMetadataMock(lastVisits);
    vault = createVaultMock([file]);
    persistence = createPersistenceMock(null);
    settings = createSettingsMock({ forgottenDaysThreshold: 15 });
    picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

    const result = await picker.pick();

    expect(result).not.toBeNull();
    expect(result?.name).toBe("note");
    expect(result?.lastVisit).toBe("2026-05-01");
    expect(result?.daysAgo).toBe(29);
  });

  describe("rotation mode", () => {
    it("returns the most forgotten note first", async () => {
      const recentFile = createMockFile("recent.md", "recent");
      const oldFile = createMockFile("old.md", "old");
      const oldestFile = createMockFile("oldest.md", "oldest");
      const lastVisits = new Map([
        ["oldest.md", "2025-01-01"],
        ["old.md", "2025-06-01"],
        ["recent.md", "2026-05-01"],
      ]);
      metadata = createMetadataMock(lastVisits);
      vault = createVaultMock([recentFile, oldFile, oldestFile]);
      persistence = createPersistenceMock(null);
      settings = createSettingsMock({ forgottenDaysThreshold: 15, forgottenNoteRotationMinutes: 10 });
      picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

      const first = await picker.pick();

      expect(first?.path).toBe("oldest.md");
    });

    it("cycles to next forgotten note after interval", async () => {
      const recentFile = createMockFile("recent.md", "recent");
      const oldFile = createMockFile("old.md", "old");
      const oldestFile = createMockFile("oldest.md", "oldest");
      const lastVisits = new Map([
        ["oldest.md", "2025-01-01"],
        ["old.md", "2025-06-01"],
        ["recent.md", "2026-05-01"],
      ]);
      metadata = createMetadataMock(lastVisits);
      vault = createVaultMock([recentFile, oldFile, oldestFile]);
      persistence = createPersistenceMock(null);
      settings = createSettingsMock({ forgottenDaysThreshold: 15, forgottenNoteRotationMinutes: 10 });
      picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

      await picker.pick();
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);

      const second = await picker.pick();

      expect(second?.path).toBe("old.md");
    });

    it("wraps around to the first note after cycling through all", async () => {
      const file1 = createMockFile("a.md", "a");
      const file2 = createMockFile("b.md", "b");
      const lastVisits = new Map([
        ["a.md", "2025-01-01"],
        ["b.md", "2025-06-01"],
      ]);
      metadata = createMetadataMock(lastVisits);
      vault = createVaultMock([file1, file2]);
      persistence = createPersistenceMock(null);
      settings = createSettingsMock({ forgottenDaysThreshold: 15, forgottenNoteRotationMinutes: 10 });
      picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

      await picker.pick();
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);
      await picker.pick();
      jest.advanceTimersByTime(10 * 60 * 1000 + 1);

      const third = await picker.pick();

      expect(third?.path).toBe("a.md");
    });

    it("null lastVisit (no frontmatter) sorts before dated notes", async () => {
      const datedFile = createMockFile("dated.md", "dated");
      const noFrontmatterFile = createMockFile("nofront.md", "nofront");
      const lastVisits = new Map([
        ["dated.md", "2025-01-01"],
        ["nofront.md", undefined],
      ]);
      metadata = createMetadataMock(lastVisits);
      vault = createVaultMock([datedFile, noFrontmatterFile]);
      persistence = createPersistenceMock(null);
      settings = createSettingsMock({ forgottenDaysThreshold: 15, forgottenNoteRotationMinutes: 10 });
      picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

      const first = await picker.pick();

      expect(first?.path).toBe("nofront.md");
    });

    it("falls back to random selection when rotation is 0", async () => {
      const file = createMockFile("note.md", "note");
      const lastVisits = new Map([["note.md", undefined]]);
      metadata = createMetadataMock(lastVisits);
      vault = createVaultMock([file]);
      persistence = createPersistenceMock(null);
      settings = createSettingsMock({ forgottenNoteRotationMinutes: 0 });
      picker = new ForgottenNotePicker(metadata, vault, persistence, settings);

      const result = await picker.pick();

      expect(result?.path).toBe("note.md");
    });
  });
});
