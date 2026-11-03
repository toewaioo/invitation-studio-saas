import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import InvitationStatus from "../src/components/InvitationStatus";

const css = readFileSync(
  new URL("../src/components/invitation-status.css", import.meta.url),
  "utf8",
);

 describe("public invitation status", () => {
  test("keeps private and unavailable invitations indistinguishable and offers retry", () => {
    const markup = renderToStaticMarkup(
      <InvitationStatus lang="my" loading={false} unavailable demo={false} onRetry={() => undefined} />,
    );
    expect(markup).toContain("ဖိတ်စာကို မရရှိနိုင်ပါ");
    expect(markup).toContain("ခဏအကြာတွင် ထပ်မံကြိုးစားပါ");
    expect(markup).toContain("ထပ်မံကြိုးစားရန်");
    expect(markup).toContain('href="/"');
    expect(markup).not.toContain("private or unavailable");
    expect(markup).not.toContain("public_key");
  });

  test("shows an accessible loading state without exposing retry prematurely", () => {
    const markup = renderToStaticMarkup(
      <InvitationStatus lang="en" loading unavailable={false} demo onRetry={() => undefined} />,
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Opening invitation…");
    expect(markup).toContain("Browser-only demo.");
    expect(markup).not.toContain("Try again");
  });

  test("includes finite decorative motion and an explicit reduced-motion override", () => {
    expect(css).toContain("@keyframes public-status-appear");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/public-status__card[\s\S]*?animation: none !important/);
  });
});
