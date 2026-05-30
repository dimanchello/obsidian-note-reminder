import { FrontmatterEditor } from "../../src/services/frontmatter-editor";

describe("FrontmatterEditor", () => {
  let editor: FrontmatterEditor;

  beforeEach(() => {
    editor = new FrontmatterEditor();
  });

  describe("setField", () => {
    it("adds frontmatter if file has none", () => {
      const content = "# Just a title\n\nSome content";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toContain("---");
        expect(result.content).toContain("date_last_visit: 2026-05-30");
        expect(result.content).toContain("# Just a title");
      }
    });

    it("updates existing field", () => {
      const content = "---\ntitle: Test\nfoo: bar\n---\n\nBody text";

      const result = editor.setField(content, "foo", "baz");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toMatch(/^---\ntitle: Test\nfoo: baz\n---/);
      }
    });

    it("adds field to existing frontmatter if missing", () => {
      const content = "---\ntitle: Test\n---\n\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toContain("date_last_visit: 2026-05-30");
        expect(result.content).toContain("title: Test");
      }
    });

    it("returns unchanged for empty content", () => {
      const content = "---\nfoo: bar\n---\n\nBody";

      const result = editor.setField(content, "foo", "bar");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toBe(content);
      }
    });
  });

  describe("getField", () => {
    it("returns field value from frontmatter", () => {
      const content = "---\ntitle: Hello\n---\n\nBody";

      const value = editor.getField(content, "title");

      expect(value).toBe("Hello");
    });

    it("returns null for missing field", () => {
      const content = "---\ntitle: Hello\n---\n\nBody";

      const value = editor.getField(content, "missing");

      expect(value).toBeNull();
    });

    it("returns null for file without frontmatter", () => {
      const content = "# Just text";

      const value = editor.getField(content, "title");

      expect(value).toBeNull();
    });
  });

  describe("updateLastVisit", () => {
    it("sets date_last_visit to today", () => {
      const content = "---\ntitle: Test\n---\n\nBody";
      const today = "2026-05-30";

      const result = editor.updateLastVisit(content, today);

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toContain(`date_last_visit: ${today}`);
      }
    });
  });

  describe("getLastVisit", () => {
    it("returns date_last_visit value", () => {
      const content = "---\ndate_last_visit: 2026-05-15\n---\n\nBody";

      const value = editor.getLastVisit(content);

      expect(value).toBe("2026-05-15");
    });

    it("returns null when field is absent", () => {
      const content = "---\ntitle: Test\n---\n\nBody";

      const value = editor.getLastVisit(content);

      expect(value).toBeNull();
    });
  });

  describe("isDateValid", () => {
    it("returns true for valid date string", () => {
      expect(FrontmatterEditor.isDateValid("2026-05-30")).toBe(true);
    });

    it("returns false for invalid date string", () => {
      expect(FrontmatterEditor.isDateValid("not-a-date")).toBe(false);
    });

    it("returns false for null", () => {
      expect(FrontmatterEditor.isDateValid(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(FrontmatterEditor.isDateValid(undefined)).toBe(false);
    });
  });

  describe("daysAgo", () => {
    beforeAll(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-05-30T12:00:00Z"));
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("returns correct days for a past date", () => {
      expect(FrontmatterEditor.daysAgo("2026-05-15")).toBe(15);
    });

    it("returns null for invalid date", () => {
      expect(FrontmatterEditor.daysAgo("bad")).toBeNull();
    });

    it("returns null for null", () => {
      expect(FrontmatterEditor.daysAgo(null)).toBeNull();
    });
  });
});
