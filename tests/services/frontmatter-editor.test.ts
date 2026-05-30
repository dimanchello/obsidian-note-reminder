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
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
        expect(result.content).toContain("title: Test");
      }
    });

    it("returns same content when setting same value", () => {
      const content = "---\nfoo: bar\n---\n\nBody";

      const result = editor.setField(content, "foo", "bar");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toBe(content);
      }
    });

    it("handles empty frontmatter", () => {
      const content = "---\n---\n\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
        expect(result.content).toContain("Body");
      }
    });

    it("preserves block-style YAML list", () => {
      const content = "---\ntags:\n  - tag1\n  - tag2\ndate_last_visit: 2026-05-29\n---\n\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toContain("tag1");
        expect(result.content).toContain("tag2");
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
      }
    });

    it("preserves inline YAML list values", () => {
      const content = "---\nprojects: [note, journal]\ndate_last_visit: 2026-05-29\n---\n\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toContain("note");
        expect(result.content).toContain("journal");
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
      }
    });

    it("preserves YAML keys after setting a different field", () => {
      const content = "---\ntitle: My Note\ntags: [hello, world]\n---\n\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toContain("title: My Note");
        expect(result.content).toContain("hello");
        expect(result.content).toContain("world");
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
      }
    });

    it("handles CRLF line endings", () => {
      const content = "---\r\ntitle: Test\r\n---\r\n\r\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
        expect(result.content).toContain("title: Test");
        expect(result.content).toContain("Body");
      }
    });

    it("handles frontmatter with only the target field", () => {
      const content = "---\ndate_last_visit: 2026-05-29\n---\n\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
        expect(result.content).toContain("Body");
      }
    });

    it("handles frontmatter with boolean and numeric values", () => {
      const content = "---\npublished: true\nweight: 42\n---\n\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toContain("published");
        expect(result.content).toContain("weight");
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
      }
    });

    it("handles non-mapping frontmatter gracefully", () => {
      const content = "---\njust a string\n---\n\nBody";

      const result = editor.setField(content, "date_last_visit", "2026-05-30");

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
        expect(result.content).toContain("Body");
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

    it("returns null for empty frontmatter", () => {
      const content = "---\n---\n\nBody";

      const value = editor.getField(content, "title");

      expect(value).toBeNull();
    });

    it("returns value from frontmatter with lists", () => {
      const content = "---\ntags: [hello, world]\ntitle: My Note\n---\n\nBody";

      const value = editor.getField(content, "title");

      expect(value).toBe("My Note");
    });

    it("returns null for non-mapping frontmatter", () => {
      const content = "---\njust text\n---\n\nBody";

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
        expect(result.content).toMatch(new RegExp(`date_last_visit: '?${today}'?`));
      }
    });

    it("preserves existing list fields when updating date_last_visit", () => {
      const content = "---\ntags:\n  - work\n  - personal\nprojects: [note, journal]\ntitle: Mixed\n---\n\nBody";
      const today = "2026-05-30";

      const result = editor.updateLastVisit(content, today);

      expect(result.kind).toBe("updated");
      if (result.kind === "updated") {
        expect(result.content).toContain("work");
        expect(result.content).toContain("personal");
        expect(result.content).toContain("note");
        expect(result.content).toContain("journal");
        expect(result.content).toContain("title: Mixed");
        expect(result.content).toMatch(/date_last_visit: '?2026-05-30'?/);
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

    it("returns null for empty frontmatter", () => {
      const content = "---\n---\n\nBody";

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
