import * as yaml from "js-yaml";
import type { FrontmatterEditResult } from "../interfaces";
import { DATE_LAST_VISIT_FIELD } from "../constants";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;
const YAML_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const YAML_DUMP_OPTIONS: yaml.DumpOptions = {
  indent: 2,
  lineWidth: -1,
  noRefs: true,
  sortKeys: false,
};

export class FrontmatterEditor {
  public setField(content: string, field: string, value: string): FrontmatterEditResult {
    const match = FRONTMATTER_REGEX.exec(content);

    if (match === null) {
      return {
        kind: "updated",
        content: `---\n${field}: ${value}\n---\n\n${content}`,
      };
    }

    const raw = match[1]!;
    let obj: Record<string, unknown>;

    if (raw.trim() === "") {
      obj = {};
    } else {
      const parsed = yaml.load(raw, { schema: yaml.FAILSAFE_SCHEMA });
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      } else {
        obj = {};
      }
    }

    obj[field] = value;

    const newYaml = yaml.dump(obj, YAML_DUMP_OPTIONS);
    const newFrontmatter = `---\n${newYaml}---`;

    return {
      kind: "updated",
      content: content.replace(match[0], newFrontmatter),
    };
  }

  public getField(content: string, field: string): string | null {
    const match = FRONTMATTER_REGEX.exec(content);
    if (match === null) return null;

    const raw = match[1]!;
    if (raw.trim() === "") return null;

    const parsed = yaml.load(raw, { schema: yaml.FAILSAFE_SCHEMA });
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const value = (parsed as Record<string, unknown>)[field];
    if (value === null || value === undefined) return null;

    if (value instanceof Date) {
      return value.toISOString().split("T")[0]!;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return null;
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
