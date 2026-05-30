import type { FrontmatterEditResult } from "../interfaces";
import { DATE_LAST_VISIT_FIELD } from "../constants";

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
const YAML_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class FrontmatterEditor {
  public setField(content: string, field: string, value: string): FrontmatterEditResult {
    const match = FRONTMATTER_REGEX.exec(content);

    if (match === null) {
      return {
        kind: "updated",
        content: `---\n${field}: ${value}\n---\n\n${content}`,
      };
    }

    const frontmatter = match[1]!;
    const fieldRegex = new RegExp(`^${escapeRegex(field)}:\\s*.*$`, "m");

    if (fieldRegex.test(frontmatter)) {
      const newFrontmatter = frontmatter.replace(fieldRegex, `${field}: ${value}`);
      return { kind: "updated", content: content.replace(frontmatter, newFrontmatter) };
    }

    const lines = frontmatter.split("\n");
    lines.splice(1, 0, `${field}: ${value}`);

    return { kind: "updated", content: content.replace(frontmatter, lines.join("\n")) };
  }

  public getField(content: string, field: string): string | null {
    const match = FRONTMATTER_REGEX.exec(content);
    if (match === null) return null;

    const frontmatter = match[1]!;
    const fieldRegex = new RegExp(`^${escapeRegex(field)}:\\s*(.*)$`, "m");
    const fieldMatch = frontmatter.match(fieldRegex);

    return fieldMatch?.[1]?.trim() ?? null;
  }

  public needsUpdate(currentValue: string | null | undefined, today: string): boolean {
    return currentValue !== today;
  }

  public static isDateValid(dateStr: string | null | undefined): boolean {
    if (dateStr === null || dateStr === undefined) return false;

    if (!YAML_DATE_REGEX.test(dateStr)) return false;

    const parsed = new Date(dateStr);
    return !Number.isNaN(parsed.getTime());
  }

  public static daysAgo(dateStr: string | null | undefined): number | null {
    if (!FrontmatterEditor.isDateValid(dateStr)) return null;

    const d = new Date(dateStr!);
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  }

  public updateLastVisit(content: string, today: string): FrontmatterEditResult {
    return this.setField(content, DATE_LAST_VISIT_FIELD, today);
  }

  public getLastVisit(content: string): string | null {
    return this.getField(content, DATE_LAST_VISIT_FIELD);
  }
}
