/*
 * template.ts
 *
 * P26/P28: shared template rendering for the configurable frontmatter template
 * and the workout filename template. Variables use {{name}} placeholders and
 * are replaced from a plain key -> string context map. Unknown placeholders are
 * left untouched so a typo is visible in the output rather than silently
 * dropped.
 */

export type TemplateContext = Record<string, string | number | boolean | null | undefined>;

/**
 * Replace every {{var}} occurrence in `template` using `context`. Values are
 * stringified; null/undefined become "". Unknown variables are left as-is.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  if (!template) {
    return "";
  }
  return template.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (whole, name: string) => {
    const value = context[name];
    if (value === null || value === undefined) {
      return whole;
    }
    return String(value);
  });
}

/** Format a Date as YYYY-MM-DD. */
export function formatTemplateDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Format a Date as HH-MM (safe for filenames). */
export function formatTemplateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${hh}-${min}`;
}
