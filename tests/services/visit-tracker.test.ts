import type { TFile } from "obsidian";
import { VisitTracker } from "../../src/services/visit-tracker";
import { FrontmatterEditor } from "../../src/services/frontmatter-editor";
import type { IMetadataReader, IVaultReader } from "../../src/interfaces";

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

function createMetadataMock(cachedDate: string | undefined): IMetadataReader {
  return {
    getFileCache: jest
      .fn()
      .mockReturnValue(
        cachedDate !== undefined
          ? { frontmatter: { date_last_visit: cachedDate } }
          : { frontmatter: {} },
      ),
  };
}

function createVaultMock(content: string): IVaultReader {
  return {
    getMarkdownFiles: jest.fn().mockReturnValue([]),
    read: jest.fn().mockResolvedValue(content),
    modify: jest.fn().mockResolvedValue(undefined),
    getAbstractFileByPath: jest.fn().mockReturnValue(null),
  };
}

describe("VisitTracker", () => {
  let editor: FrontmatterEditor;
  let vault: IVaultReader;
  let metadata: IMetadataReader;
  let tracker: VisitTracker;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-30T12:00:00Z"));
    editor = new FrontmatterEditor();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips update if cached date_last_visit already matches today", async () => {
    metadata = createMetadataMock("2026-05-30");
    vault = createVaultMock("---\ntitle: Test\ndate_last_visit: 2026-05-30\n---\n\nBody");
    tracker = new VisitTracker(editor, metadata, vault);

    await tracker.onFileOpened(createMockFile("test.md", "test"));

    expect(vault.read).not.toHaveBeenCalled();
    expect(vault.modify).not.toHaveBeenCalled();
  });

  it("updates date_last_visit when cached value differs", async () => {
    metadata = createMetadataMock("2026-05-15");
    vault = createVaultMock("---\ntitle: Test\ndate_last_visit: 2026-05-15\n---\n\nBody");
    tracker = new VisitTracker(editor, metadata, vault);

    await tracker.onFileOpened(createMockFile("test.md", "test"));

    expect(vault.read).toHaveBeenCalledTimes(1);
    expect(vault.modify).toHaveBeenCalledTimes(1);
  });

  it("updates date_last_visit when cached value is missing", async () => {
    metadata = createMetadataMock(undefined);
    vault = createVaultMock("---\ntitle: Test\n---\n\nBody");
    tracker = new VisitTracker(editor, metadata, vault);

    await tracker.onFileOpened(createMockFile("test.md", "test"));

    expect(vault.read).toHaveBeenCalledTimes(1);
    expect(vault.modify).toHaveBeenCalledTimes(1);
  });

  it("adds frontmatter if file has none", async () => {
    metadata = {
      getFileCache: jest.fn().mockReturnValue({ frontmatter: undefined }),
    };
    vault = createVaultMock("# Content without frontmatter");
    tracker = new VisitTracker(editor, metadata, vault);

    await tracker.onFileOpened(createMockFile("test.md", "test"));

    expect(vault.read).toHaveBeenCalledTimes(1);
    expect(vault.modify).toHaveBeenCalledTimes(1);
    const modifyMock = vault.modify as jest.Mock;
    const calls = modifyMock.mock.calls as string[][];
    const modifiedContent = calls[0]?.[1] ?? "";
    expect(modifiedContent).toContain("date_last_visit: 2026-05-30");
  });
});
