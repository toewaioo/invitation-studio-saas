import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { myDigits } from './invitationData';
import type { RouteArrivalTarget, VenueRoute } from './venueRoutes';
import './route-guidance.css';

type Props = { routes: VenueRoute[]; fallbackHref: string; fallbackTarget: RouteArrivalTarget | null };

/** The invitation never renders the event clock. A route click explicitly opens
 * a separate planning dialog; only there is its arrival target disclosed.
 * Future-time selection must be completed manually in Maps, not faked in a URL.
 */
export default function RouteGuidance({ routes, fallbackHref, fallbackTarget }: Props) {
  const [selected, setSelected] = useState<VenueRoute | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const opener = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => { if (selected && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [selected]);
  function open(event: MouseEvent<HTMLAnchorElement>, route: VenueRoute) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener.current = event.currentTarget;
    setSelected(route);
  }
  const fallback: VenueRoute = { id: 'supplied', label: 'ပေးထားသော မြေပုံ', detail: 'မူရင်းမြေပုံလင့်ခ်', href: fallbackHref, arrivalTarget: fallbackTarget };
  return <>
    {routes.length > 0 ? <ol className="venue-routes">
      {routes.map((route, index) => <li key={route.id}>
        <a href={route.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title={route.detail} aria-haspopup="dialog" onClick={event => open(event, route)}>
          <span className="route-number" aria-hidden="true">{myDigits(index + 1)}</span>
          <span className="route-label">{route.label}</span>
          <span className="route-arrow" aria-hidden="true">↗</span>
          <span className="sr-only"> — {route.detail}၊ ရောက်ချိန်ဖြင့် ခရီးစီစဉ်ရန်</span>
        </a>
      </li>)}
    </ol> : fallbackHref ? <a className="route-fallback" href={fallbackHref} target="_blank" rel="noopener noreferrer" aria-haspopup="dialog" onClick={event => open(event, fallback)}>ပေးထားသော မြေပုံမှ လမ်းကြောင်းရွေးရန် ↗</a> : <p className="route-empty">နေရာအသေးစိတ်ကို အောက်တွင် ကြည့်နိုင်ပါသည်။</p>}
    {selected && createPortal(<dialog ref={dialog} className="route-guidance-dialog" aria-labelledby={titleId} onClose={() => { setSelected(null); opener.current?.focus(); }}>
      <header><div><small>လမ်းကြောင်း စီစဉ်ရန်သာ</small><h2 id={titleId}>{selected.label}</h2></div><button type="button" aria-label="လမ်းကြောင်းစီစဉ်မှု ပိတ်ရန်" onClick={() => dialog.current?.close()}>×</button></header>
      {selected.arrivalTarget ? <section className="route-arrival-target" aria-label="စီစဉ်ရန် ရောက်ချိန်">
        <h3>ရောက်ရှိရန် ရည်မှန်းချိန်</h3>
        <p>{selected.arrivalTarget.label}</p>
        <small>ဤအချိန်ကို ခရီးစီစဉ်ရန်သာ ပြထားပြီး ဖိတ်စာနှင့် ပြက္ခဒိန်တွင် မဖော်ပြပါ။</small>
      </section> : <p className="route-planning-warning">ရောက်ချိန်အတိအကျ မသတ်မှတ်နိုင်သေးပါ။ ပွဲရှင်ထံ အချိန်အတည်ပြုပြီး Maps တွင် ရွေးပါ။ အချိန်ကို ခန့်မှန်းဖြည့်မထားပါ။</p>}
      <p className="route-url-limitation">ဤလင့်ခ်က Maps ၏ ရောက်ချိန်ကို အလိုအလျောက် မဖြည့်ပေးနိုင်ပါ။ အောက်ပါအတိုင်း ကိုယ်တိုင် ရွေးရပါမည်။</p>
      <ol className="route-planning-steps">
        <li>Google Maps ကိုဖွင့်၍ မိမိစတင်ရာကို အတည်ပြုပါ။</li>
        <li>ကား / အများပြည်သူသုံးယာဉ်ကို ရွေးပြီး “Leave now” မှ “Arrive by” ကို ရွေးပါ။</li>
        <li>{selected.arrivalTarget ? 'အထက်ပါ ရက်နှင့် မြန်မာစံတော်ချိန်ကို ထည့်ပါ။ စက်၏အချိန်ဇုန်ကွာပါက ပြောင်းလဲထည့်ပါ။' : 'အတည်ပြုထားသော ရောက်မည့်ရက်နှင့် အချိန်ကို ထည့်ပါ။'} Maps တွက်ပေးသည့် ခန့်မှန်းကြာချိန် / ထွက်ခွာချိန်ကို ကြည့်ပါ။</li>
      </ol>
      <p className="route-planning-caveat">“Arrive by” မတွေ့ပါက Maps ထဲ ဝင်ရောက်ထားကြောင်း စစ်ပြီး ကွန်ပျူတာ browser မှ စမ်းပါ။ နေရာတစ်ခုသို့ ကား / အများပြည်သူသုံးယာဉ် ခရီးစဉ်အတွက်သာ ရနိုင်ပါသည်။ မရရှိပါက လက်ရှိကြာချိန်ကိုသာ စစ်နိုင်ပြီး ပွဲနေ့ခန့်မှန်းချက်ဟု မယူဆပါနှင့်။</p>
      <a className="route-open-maps" href={selected.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Google Maps တွင် ရောက်ချိန်ရွေးရန် ↗</a>
      <p className="route-planning-caveat">ဤနေရာတွင် ခရီးကြာချိန်နှင့် ထွက်ခွာချိန်ကို မခန့်မှန်းထားပါ။ Maps ခန့်မှန်းချက်များသည် ယာဉ်ကြောအခြေအနေအလိုက် ပြောင်းလဲနိုင်ပါသည်။</p>
      <a className="route-planning-help" href="https://support.google.com/maps/answer/6291839?hl=en" target="_blank" rel="noopener noreferrer">Google Maps ၏ အနာဂတ်ခရီးစဉ် စီစဉ်နည်း ↗</a>
    </dialog>, document.body)}
  </>;
}
