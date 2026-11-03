import type { ReactNode } from "react";

/** Parent fields may contain names, addresses and explicit line breaks. Keep
 * each supplied whitespace-delimited unit together; paired double quotes mark
 * text to emphasize on its own visual line without changing the stored value.
 */
function appendPlainText(parts: ReactNode[], value: string, offset: number) {
  value.split(/([ \t\r\n]+)/u).forEach((part, index) => {
    parts.push(
      !part || /^[ \t\r\n]+$/u.test(part)
        ? part
        : <span className="traditional-parent-unit" key={`plain-${offset}-${index}`}>{part}</span>,
    );
  });
}

export default function ParentText({ value }: { value: string }) {
  const parts: ReactNode[] = [];
  const quoted = /"([^"]+)"/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = quoted.exec(value))) {
    const start = match.index;
    const end = start + match[0].length;
    appendPlainText(parts, value.slice(cursor, start), cursor);

    const precedingLineStart = Math.max(
      value.lastIndexOf("\n", start - 1),
      value.lastIndexOf("\r", start - 1),
    ) + 1;
    const lineBreakAfter = [value.indexOf("\n", end), value.indexOf("\r", end)]
      .filter((index) => index >= 0)
      .reduce((nearest, index) => Math.min(nearest, index), value.length);
    const needsBreakBefore = value.slice(precedingLineStart, start).trim().length > 0;
    const needsBreakAfter = value.slice(end, lineBreakAfter).trim().length > 0;

    if (needsBreakBefore) parts.push(<br key={`before-${start}`} />);
    parts.push(
      <strong className="traditional-parent-emphasis" key={`emphasis-${start}`}>
        {match[1]}
      </strong>,
    );
    if (needsBreakAfter) parts.push(<br key={`after-${start}`} />);
    cursor = end;
  }

  appendPlainText(parts, value.slice(cursor), cursor);
  return <>{parts}</>;
}
