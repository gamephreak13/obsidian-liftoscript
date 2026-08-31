/*
 * appendLine.ts
 *
 * Pure string helpers for routing generated liftoscript lines into a note:
 *   - insertLineIntoLastBlock: put a line inside the last ```liftoscript fence,
 *     or append a fresh fence if none exists.
 *   - stripFrontmatter: drop leading YAML so an inline daily-note append gets
 *     only the workout body.
 */

/** Insert a line into the last ```liftoscript block, or append a new one. */
export function insertLineIntoLastBlock(text: string, line: string): string {
  const fence = /```\s*liftoscript\s*\n([\s\S]*?)```/gi;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text))) {
    lastMatch = m;
  }
  if (lastMatch) {
    const closingFence = text.lastIndexOf("```", lastMatch.index + lastMatch[0].length);
    const head = text.slice(0, closingFence);
    const tail = text.slice(closingFence);
    return head.replace(/\s*$/, "") + "\n" + line + "\n" + tail;
  }
  const block = "```liftoscript\n" + line + "\n```";
  return text.replace(/\s*$/, "") + "\n\n" + block + "\n";
}

/** Remove leading YAML frontmatter from a note's body for inline appends. */
export function stripFrontmatter(content: string): string {
  const m = content.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? content.slice(m[0].length) : content;
}
