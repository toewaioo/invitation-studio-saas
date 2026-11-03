import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import ParentText from "../src/components/ParentText";
import { renderedParentTexts, visibleText } from "./helpers/markup-text";

describe("ParentText", () => {
  test("preserves Burmese names, whitespace, newlines, and NBSP as visible text", () => {
    const value = "ဦးအောင်မင်း  နှင့်\nဒေါ်ခင်မြ\u00a0နမူနာ";
    const html = renderToStaticMarkup(<p className="traditional-parents"><ParentText value={value} /></p>);
    expect(visibleText(html)).toBe(value);
    expect(renderedParentTexts(html)).toEqual([value]);
    expect((html.match(/class="traditional-parent-unit"/g) ?? []).length).toBe(3);
  });

  test("quoted Burmese names lose their markers and render bold on a standalone line", () => {
    const value = "ရန်ကုန်တိုင်းဒေသကြီး၊ အမှတ်(၁၉)နေ \"ဦးမောင်မောင် ဒေါ်ခင်ခင်\" တို့၏ သား၊ မိသားစုဝင်များအားလုံး";
    const expected = value.replace(/"([^"]+)"/gu, "$1");
    const html = renderToStaticMarkup(<p className="traditional-parents"><ParentText value={value} /></p>);

    expect(visibleText(html)).toBe(expected);
    expect(renderedParentTexts(html)).toEqual([expected]);
    expect(html).toContain('<br/><strong class="traditional-parent-emphasis">ဦးမောင်မောင် ဒေါ်ခင်ခင်</strong><br/>');
    expect(html).not.toContain('"ဦးမောင်မောင်');
  });

  test("keeps existing explicit line breaks around a quoted name without adding more", () => {
    const value = "လိပ်စာအချက်အလက်၊\n\"ဦးမောင်မောင် ဒေါ်ခင်ခင်\"\nတို့၏ သား၊\nဒုတိယစာကြောင်း";
    const expected = value.replace(/"([^"]+)"/gu, "$1");
    const html = renderToStaticMarkup(<p className="traditional-parents"><ParentText value={value} /></p>);

    expect(visibleText(html)).toBe(expected);
    expect(renderedParentTexts(html)).toEqual([expected]);
    expect(html).toContain('\n<strong class="traditional-parent-emphasis">ဦးမောင်မောင် ဒေါ်ခင်ခင်</strong>\n');
    expect(html).not.toContain("<br/>");
  });

  test("escapes markup in both ordinary and quoted text", () => {
    const value = "ဦး<မိဘ> & \"ဒေါ်<script>alert(1)</script>\"\nနမူနာ";
    const html = renderToStaticMarkup(<p className="traditional-parents"><ParentText value={value} /></p>);
    const expected = value.replace(/"([^"]+)"/gu, "$1");

    expect(visibleText(html)).toBe(expected);
    expect(html).toContain("&lt;မိဘ&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
