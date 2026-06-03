import type { TFile } from "obsidian";
import { VisitTracker } from "../../src/services/visit-tracker";
import type { IDataPersistence, IPluginData } from "../../src/interfaces";

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

describe("VisitTracker", () => {
  let persistence: IDataPersistence;
  let tracker: VisitTracker;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-30T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips update if visit already exists for today", async () => {
    persistence = createPersistenceMock({
      visits: { "test.md": "2026-05-30" },
    });
    tracker = new VisitTracker(persistence);

    await tracker.onFileOpened(createMockFile("test.md", "test"));

    expect(persistence.saveData).not.toHaveBeenCalled();
  });

  it("updates visit when cached value differs", async () => {
    persistence = createPersistenceMock({
      visits: { "test.md": "2026-05-15" },
    });
    tracker = new VisitTracker(persistence);

    await tracker.onFileOpened(createMockFile("test.md", "test"));

    expect(persistence.saveData).toHaveBeenCalledTimes(1);
  });

  it("adds visit when file has no existing entry", async () => {
    persistence = createPersistenceMock(null);
    tracker = new VisitTracker(persistence);

    await tracker.onFileOpened(createMockFile("test.md", "test"));

    expect(persistence.saveData).toHaveBeenCalledTimes(1);
    const saveMock = persistence.saveData as jest.Mock;
    const calls = saveMock.mock.calls as IPluginData[][];
    const savedData = calls[0]?.[0] ?? {};
    expect(savedData.visits).toEqual({ "test.md": "2026-05-30" });
  });

  it("updates path in visits when file is renamed", async () => {
    persistence = createPersistenceMock({
      visits: { "old/path.md": "2026-05-15" },
    });
    tracker = new VisitTracker(persistence);

    await tracker.onFileRenamed("old/path.md", "new/path.md");

    expect(persistence.saveData).toHaveBeenCalledTimes(1);
    const saveMock = persistence.saveData as jest.Mock;
    const calls = saveMock.mock.calls as IPluginData[][];
    const savedData = calls[0]?.[0] ?? {};
    expect(savedData.visits).toEqual({ "new/path.md": "2026-05-15" });
    expect(savedData.visits?.["old/path.md"]).toBeUndefined();
  });

  it("does nothing on rename if old path not in visits", async () => {
    persistence = createPersistenceMock({
      visits: { "other.md": "2026-05-15" },
    });
    tracker = new VisitTracker(persistence);

    await tracker.onFileRenamed("unknown.md", "new.md");

    expect(persistence.saveData).not.toHaveBeenCalled();
  });

  it("preserves existing pick data when saving visit", async () => {
    persistence = createPersistenceMock({
      lastPickTime: 1000,
      lastPickPath: "some.md",
    });
    tracker = new VisitTracker(persistence);

    await tracker.onFileOpened(createMockFile("test.md", "test"));

    const saveMock = persistence.saveData as jest.Mock;
    const calls = saveMock.mock.calls as IPluginData[][];
    const savedData = calls[0]?.[0] ?? {};
    expect(savedData.lastPickTime).toBe(1000);
    expect(savedData.lastPickPath).toBe("some.md");
    expect(savedData.visits).toEqual({ "test.md": "2026-05-30" });
  });
});
