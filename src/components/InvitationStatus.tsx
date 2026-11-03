import { ArrowLeft, LoaderCircle, LockKeyhole, RefreshCw } from "lucide-react";
import type { Language } from "../types";
import "./invitation-status.css";

type Props = {
  lang: Language;
  loading: boolean;
  unavailable: boolean;
  demo: boolean;
  onRetry: () => void;
};

export default function InvitationStatus({
  lang,
  loading,
  unavailable,
  demo,
  onRetry,
}: Props) {
  const english = lang === "en";
  const busy = loading || !unavailable;

  return (
    <main
      className={`public-status${english ? " is-english" : ""}`}
      aria-busy={busy}
      aria-live="polite"
    >
      <div className="public-status__wash" aria-hidden="true" />
      <section className="public-status__card" aria-labelledby="public-status-title">
        <span className="public-status__corner public-status__corner--top" aria-hidden="true" />
        <span className="public-status__corner public-status__corner--bottom" aria-hidden="true" />
        <div className={`public-status__seal${busy ? " is-loading" : ""}`} aria-hidden="true">
          <span className="public-status__seal-ring">
            {busy ? <LoaderCircle size={29} strokeWidth={1.5} /> : <LockKeyhole size={29} strokeWidth={1.5} />}
          </span>
        </div>
        <p className="public-status__kicker">{english ? "METTA INVITATION" : "မေတ္တာစာ · ဖိတ်စာ"}</p>
        <div className="public-status__rule" aria-hidden="true"><span>✦</span></div>
        <h1 id="public-status-title">
          {busy
            ? (english ? "Opening invitation…" : "ဖိတ်စာဖွင့်နေပါသည်…")
            : (english ? "This invitation isn’t available" : "ဖိတ်စာကို မရရှိနိုင်ပါ")}
        </h1>
        <p className="public-status__message">
          {busy
            ? (english ? "Just a moment, please." : "ခဏစောင့်ပေးပါ…")
            : (english
              ? "Please check the link or try again in a moment."
              : "ဖိတ်စာလင့်ခ်ကို စစ်ဆေးပါ၊ သို့မဟုတ် ခဏအကြာတွင် ထပ်မံကြိုးစားပါ။")}
        </p>
        {demo && (
          <p className="public-status__demo">
            {english
              ? "Browser-only demo. Links work only in the browser where they were created."
              : "စမ်းသပ်မုဒ်ဖြစ်သည်။ လင့်ခ်များသည် ဖန်တီးခဲ့သော browser တွင်သာ အလုပ်လုပ်ပါသည်။"}
          </p>
        )}
        {!busy && (
          <div className="public-status__actions">
            <button className="public-status__retry" type="button" onClick={onRetry}>
              <RefreshCw size={16} strokeWidth={1.8} />
              {english ? "Try again" : "ထပ်မံကြိုးစားရန်"}
            </button>
            <a className="public-status__back" href="/">
              <ArrowLeft size={15} strokeWidth={1.8} />
              {english ? "Back to studio" : "စတူဒီယိုသို့ ပြန်သွားရန်"}
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
