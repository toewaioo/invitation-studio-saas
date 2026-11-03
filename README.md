# မေတ္တာစာ · Invitation Studio

မူလ Flask / plain JavaScript / SQLite prototype ကို **React + TypeScript + Bun + Supabase** အတွက် ပြန်တည်ဆောက်ထားသော customer-facing invitation studio ဖြစ်ပါသည်။ Professional neutral dashboard၊ မြန်မာ/English ဘာသာနှစ်မျိုးနှင့် customer/project စီမံခန့်ခွဲမှုကို ထည့်သွင်းထားပြီး မူလ immersive 3D envelope/book ဖိတ်စာဒီဇိုင်းများကို ထိန်းသိမ်းထားပါသည်။

## Public showcase + account-free creation (current behavior)

`/` is now a public, sample-only showcase, not the dashboard. All three invitation designs and the existing responsive Burmese previews are preserved. Public pages never load the private project list. `/create` (and `/studio`) opens the account-free creator: event details, design, up to three JPG/PNG/WebP photos (1 MiB each), review, then publish. No guest signup/login, customer contacts, private notes, saved drafts or secret edit links are introduced. A successful publish returns a public viewing link and the existing heart QR. Publishing is final through the guest API; review carefully and keep the share link because there is no account-based recovery.

`/manage` (and `/dashboard`) keeps the existing projects/customers/design workspace behind password sign-in at the same-origin server API and the server-only `STUDIO_ADMIN_USER_ID` allowlist. Every private operation verifies the user with Supabase Auth and keeps the user's JWT for existing owner-scoped RLS. Access/refresh tokens are HttpOnly, SameSite=Lax cookies (Secure in production); no tokens are returned to browser JavaScript. Empty admin UUID means management stays locked. Existing owner invitation links use the original RPC with guest lookup only as a fallback.

## Server-only Supabase access (current architecture)

The browser calls only `/api/studio?action=...`; it no longer imports the Supabase SDK, connects to REST/RPC/Auth/Storage directly, or receives Supabase keys. The Node/Vercel gateway in `api/studio.ts` allowlists actions, validates owner identity and same-origin mutations, and proxies private/public photos without exposing signed storage URLs. The existing guest Edge function still owns privileged account-free creation; the gateway requires no service-role key. No schema, migration, RLS, customer data or share-key change is part of this access-layer update.

For deployment, set **server runtime** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STUDIO_ADMIN_USER_ID`, and `APP_ORIGIN=https://love-birds-mm.vercel.app`; retain the existing project and owner UUID. Remove obsolete `VITE_SUPABASE_*` / `VITE_STUDIO_ADMIN_USER_ID` variables when releasing. Never put a privileged key in a `VITE_` variable. `VITE_LOCAL_DEMO=true` is an optional offline-only mode; leave it false/unset for production. A broken/missing backend fails closed rather than falling back to browser storage.

Use `npm run dev` or `npm run preview` for a local Node-backed preview; Vite middleware serves the same API using `.env.local`. Production needs Vercel Functions plus `dist/`, not static-only hosting. The SPA rewrite must exclude `/api`. Owner files are sent individually as binary (up to 4 MiB), avoiding base64 growth past the host body limit; guests keep the existing three 1 MiB photo limit. The owner must sign in again after cutover because legacy localStorage tokens are not imported into the new cookies.

Before production cutover, verify a preview deployment with owner login/refresh/logout, owner upload/publish/revoke, both existing share-link types, and guest creation from separate client IPs. The Vercel-to-Edge IP forwarding and rate-limit behavior need a deployed smoke test; no automatic repeated publishing on uncertain responses. Routing through server functions adds a server dependency and extra photo/API hops. Roll back the Vercel deployment if needed; no database rollback is needed. Do not rerun existing migrations or redeploy Edge functions merely for this gateway change.

### Existing guest backend (reference for a fresh setup)

The source includes a separate guest migration and `supabase/functions/guest-invitation/index.ts`; neither existing customer tables nor their policies are relaxed. New guest records are private at table level, immutable through public APIs, and read only using `guest_public_project(username,key)`. Guest photos use bounded image data URLs for this initial version, not the existing owner photo bucket.

For a fresh project only, apply the guest migration and deploy `guest-invitation` using `supabase/config.toml`, and set server-only `ALLOWED_ORIGINS` (exact comma-separated app origins) and a random private `IP_HASH_SALT`. Standard server-side `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be available. Never put service-role keys or hash salts in `VITE_` variables. Missing origin configuration, salt or client IP fails closed. CORS is not authentication: the database also atomically caps creation at five per hashed IP/hour and 200 total/day, with server-side request/photo/field limits. Ensure the chosen client-IP header is supplied or sanitized by a trusted edge proxy; add gateway bot protection before high-volume use.

No remote migration or function deployment is performed in this access-layer change. The current production project already has both guest and photo Edge functions; live creation/cross-device viewing through the new gateway remain deployment validation steps. Provision the owner Auth account separately and set its UUID in `STUDIO_ADMIN_USER_ID`; guests need no owner account. Build: `npm run build`. Tests: `npx --yes bun --no-env-file run test` if Bun is not installed globally. Security tests use local PGlite fixtures, not live Auth E2E. Older verification notes below describe earlier development phases.

## Responsive event typography — စာသားကျပ်ခြင်း ပြင်ဆင်ချက်

Formal invitation ၏ date/time ကို ကျဉ်းသော ဘေးချင်းယှဉ်ကော်လံများအစား **နေ့ရက်၊ အချိန်၊ နေရာ သီးခြားအတန်းသုံးတန်း** ဖြင့် ပြသည်။ Label သေးသေးနှင့် `minmax(0,1fr)` value column ကို သုံး၍ ရက်ရှည်/အချိန်ရှည်/လိပ်စာများ အလိုအလျောက် စာကြောင်းဆင်းသည်။ နေရာကို အကြီးစား bold မသုံးတော့ဘဲ event values အားလုံး **11.5–12px၊ weight 400၊ line-height 1.75** ဖြင့် တစ်သမတ်တည်းပြသည်။ Full names သည် 14–20px၊ ornate title သည် 15–18px အတွင်းသာ ဖြစ်ပြီး မိဘအမည်နှင့် ဖိတ်ကြားစာသည် 12px ဖြစ်သည်။ Narrow 320px တွင် ထပ်နေသော decorative divider/endmark ကိုသာ ချန်၍ စာသားအတွက် နေရာပေးသည်။ အမည်/လိပ်စာ/ဖိတ်ကြားစာကို မဖျောက်၊ အတိုကောက်မသုံး၊ ellipsis/line clamp မသုံးပါ။

`useCardFit` သည် card height သာမက `scrollWidth`/`scrollHeight` နှင့် event values/name/wording/parents ၏ အတွင်းပိုင်း overflow ကိုပါ စစ်သည်။ Standard `HH:mm` အချိန်ကိုသာ clock/countdown/calendar data အဖြစ် သုံးပြီး ပေးထားပြီးသား Burmese time wording ကို unit ထပ်မတိုးဘဲ အပြည့်အစုံပြသည်။ မသိရသော အချိန်ကို ခန့်မှန်း၍ calendar event မထုတ်ပါ။

နောက်ဆုံး verification: **build / typecheck / tests ၅၂ ခု၊ assertions ၇၃၁ ခု pass**။ Browser matrix **၃၆၀ cases** တွင် ဒီဇိုင်းသုံးမျိုး × normal/long Burmese venue/date/time နမူနာနှစ်မျိုး × စာမျက်နှာခြောက်ခု × **320×568၊ 360×640၊ 390×600၊ 414×736၊ 1280×720** × 3D/QA-only untransformed paper view တို့ကို စစ်ထားသည်။ စမ်းသပ်ထားသော content အားလုံး၌ formal cards `data-fit="ready"`၊ စာသား bounds အပြင်ထွက်မှုမရှိ၊ event label/value overlap မရှိ၊ document/paper scroll မရှိပါ။ Flat check သည် QA harness တွင် book transforms ကို ပိတ်စစ်ခြင်းသာ ဖြစ်ပြီး dashboard ထဲ view feature အသစ် မထည့်ပါ။ Physical device/Safari နှင့် authenticated Supabase E2E မဟုတ်ပါ။ Dashboard၊ motion engine၊ QR/security code နှင့် Supabase/customer data မပြောင်းပါ။

## အချက်အလက်ပြည့်စုံသော 3D preview

ဒီဇိုင်းရွေး၍ preview ဖွင့်သည့်အခါ `src/lib/designPreview.ts` က မူလ `/workspace/thazin-invitation/index.html` တွင် ပါပြီးသား စိတ်ကူးယဉ် demo အချက်အလက်များဖြင့် in-memory preview ကို တည်ဆောက်သည်။ မောင်သီဟအောင် / မနှင်းသဇင်၊ မူလမိဘအမည်နှစ်ဖက်၊ ဖိတ်ကြားစာ၊ 2027-02-14 / 09:00၊ မူလ venue/လိပ်စာအပြည့်အစုံ၊ ပေးထားပြီးသား HTTPS Google Maps directions URL နှင့် bundled နမူနာဓာတ်ပုံသုံးပုံ ပါဝင်သည်။ အချက်အလက်အသစ် မခန့်မှန်းပါ။ လက်ရှိ form တွင် end-time၊ RSVP သို့မဟုတ် သီးခြား schedule fields မရှိသဖြင့် မူလ demo မှ extra event times များကို မထည့်ပါ။

စာမျက်နှာ ၆ ခုတွင် — **၁**: 3D pop-up/full names၊ **၂**: မိဘအမည် → full names → invitation message → date/time/venue → map link ဟူသော ရိုးရာအစဉ်၊ **၃**: calendar/countdown၊ **၄**: ပေးထားသောရက်/အချိန်နှင့် venue၊ **၅**: venue/လိပ်စာနှင့် exact supplied map/directions၊ **၆**: ဓာတ်ပုံအားလုံးနှင့် captions/gallery ကို ပြသည်။ Valid map URL မပေးပါက မြေပုံမဖန်တီးပါ။ Embedded map tiles သည် Google/network availability အပေါ် မူတည်ပြီး supplied external directions link ကိုလည်း သီးခြားပေးထားသည်။

Demo သည် **draft / public_key=null** သာဖြစ်၍ မသိမ်း၊ မ publish လုပ်၊ QR/share key မထုတ်ပါ။ Customer name/email/phone/private notes/internal project title တို့သည် guest-facing ဖိတ်စာအချက်အလက် မဟုတ်သဖြင့် မဖော်ပြပါ။ Project form မှ preview သည် ဖြည့်ထားသော values နှင့် selected/uploaded photos ကိုသာ ဆက်သုံးပြီး demo details ကို real project ထဲ မပေါင်းထည့်ပါ။ Optional parents/message/date/time/venue/map/photos မဖြည့်ထားလျှင် empty placeholder စာသား/ပုံဘောင် မပြပါ။ Required full names မရှိပါက နာမည်အသစ် မခန့်မှန်းပါ။

Complete-preview အဆင့်၏ ယခင် verification: **build / typecheck / tests ၄၇ ခု၊ assertions ၆၆၅ ခု pass**။ ဒီဇိုင်းသုံးမျိုး × စာမျက်နှာခြောက်ခုကို **320×568၊ 390×600၊ 1280×600** တွင် rendered text bounds နှင့် no-scroll geometry ဖြင့် စစ်ထားသည်။ Formal cards အားလုံး `data-fit="ready"` ဖြစ်သည်။ Three-photo album ၏ intrinsic-image height ကြောင့် caption ပြတ်နိုင်သောနေရာကို explicit grid-row sizing ဖြင့် ပြင်ထားသည်။ Gallery ပြန်ဖွင့်/ပိတ်ခြင်းနှင့် optional-empty fixture ကိုလည်း စစ်ထားသည်။ Desktop/mobile browser frames သာဖြစ်ပြီး physical-device သို့မဟုတ် authenticated live Supabase E2E test မဟုတ်ပါ။ Dashboard layout/styles၊ editor၊ repository၊ motion engine၊ QR decoder၊ SQL/Edge Function နှင့် existing Supabase/customer data မပြောင်းပါ။

## Ornate invitation atelier — ဒီဇိုင်းနှင့် စာလုံးအသစ်

Customer-facing ဖိတ်စာများကို layered ivory paper၊ jewel-tone ink နှင့် foil-like gold tooling ပုံစံဖြင့် ပြင်ထားသည်။ **Thazin** တွင် မြစိမ်းရောင် arched title cartouche နှင့် ပန်းနွယ်ဘောင်၊ **Golden Vow** တွင် ink-black masthead၊ double-rule ရွှေရောင်စာတန်းနှင့် stepped Art Deco frame၊ **Rose Reverie** တွင် blush letterpress title၊ wine-coloured names၊ scalloped lines နှင့် နှင်းဆီအလှဆင်ကို သုံးထားသည်။ မြန်မာအလှဆင်အငွေ့အသက်ကို ယူထားသော contemporary design ဖြစ်ပြီး သမိုင်းဝင် motif အစစ်ဖြစ်သည်ဟု မဆိုလိုပါ။ Theme လေးမျိုးကို ဆက်ရွေးနိုင်သည်။

ခေါင်းစဉ်နှင့် အမည်များအတွက် locally bundled **Noto Serif Myanmar 600/700** ကို သုံးပြီး မိဘအမည်၊ ဖိတ်ကြားစာနှင့် နေရာ/ရက်/အချိန်ကို **Noto Sans Myanmar** ဖြင့် ဖတ်ရလွယ်အောင် ခွဲထားသည်။ Myanmar names ကို artificial tracking၊ italic skew၊ initials သို့မဟုတ် ellipsis မသုံးပါ။ Bold font ကို [official Google Fonts source](https://github.com/google/fonts/tree/main/ofl/notoserifmyanmar) မှ ရယူထားပြီး `public/assets/ornate-fonts/OFL.txt` တွင် SIL Open Font License ပါဝင်သည်။ Existing regular/semibold fonts ကို ပြန်သုံးသည်။ External font CDN မခေါ်ပါ။

`invitation-ornate.css` သည် `.invite` root အောက်တွင်သာ သက်ရောက်သည်။ `PaperFiligree.tsx` သည် `aria-hidden` decorative SVG ဖြစ်ပြီး စာသား flow ကို မယူဘဲ paper leaf တစ်ခုချင်းနှင့်အတူ 3D page curl တွင် လှုပ်ရှားသည်။ Formal card ၏ traditional content order မပြောင်းပါ။ ပုံ ၄–၆ ပုံပါ album ကို fixed thumbnail grid ဖြင့် ပြပြီး caption များကို စာမျက်နှာအတွင်းထားသည်။ Existing envelope opening၊ pop-up/replay၊ swipe/page turns နှင့် photo gallery ကို ထိန်းထားသည်။

Ornate ဒီဇိုင်းအဆင့်၏ ယခင် verification: **build၊ typecheck၊ tests ၄၃ ခု / assertions ၅၃၈ ခု pass** (နောက်ဆုံးရလဒ် ၅၂ ခု / ၇၃၁ ခုကို အပေါ်တွင်ကြည့်ပါ)။ ဒီဇိုင်းသုံးမျိုးစလုံး၏ six-page experience ကို 320×568 တွင် စစ်ထားပြီး long-name/wording fixtures ၏ formal card များ၌ `data-fit="ready"`၊ နေရာ/ရက်/အချိန် မြင်ရခြင်း၊ text bounds နှင့် document/paper scroll မရှိခြင်းကို စစ်ထားသည်။ 390×600 mobile screenshots၊ 768×1024 tablet နှင့် 1280×600/720 desktop fitting၊ repeated gallery open/close သုံးကြိမ်ကိုလည်း စစ်ထားသည်။ Screenshots/QA data သည် synthetic samples ဖြစ်ပြီး real customer records မဟုတ်ပါ။ Physical device/Safari နှင့် authenticated live Supabase E2E test အပြည့်အစုံ မဟုတ်ပါ။

Dashboard/editor၊ 3D motion engine၊ heart-silhouette QR generation/decoder၊ repository၊ SQL migrations နှင့် Edge Function မပြောင်းကြောင်း source checksums ဖြင့် စစ်ထားသည်။ Live Supabase/customer data ကို မရေး/မဖျက်/မရွှေ့ထားပါ။ Temporary port-8767 preview ကို ဆက်အသုံးပြုသည်။ Permanent hosting/domain၊ Auth redirects နှင့် authenticated Supabase upload/publish E2E verification မပြီးမချင်း **partially production-ready** သာဖြစ်သည်။

## Scroll မလိုသော တစ်မျက်နှာစာ ဖိတ်စာ

ဖိတ်စာသည် `100dvh` viewport တစ်ခုထဲတွင် စာအုပ်၊ page navigation နှင့် အောက်ခြေ controls ကို နေရာသီးခြားပေးထားသည်။ စာမျက်နှာကို scroll လုပ်ရန် မလိုတော့ပါ။ `one-screen.css` က စာအိတ်၊ pop-up၊ calendar၊ schedule၊ venue နှင့် album ၏ အမြင့်/spacing ကို viewport အလိုက် ညှိသည်။ Dashboard preview dialog ဖွင့်ထားစဉ် နောက်ခံ dashboard scroll ကိုလည်း ပိတ်ထားသည်။

ရိုးရာဖိတ်စာကို `useCardFit.ts` က actual rendered text နှင့် available paper size ကို တိုင်း၍ font/spacing density ကို ပြန်ညှိသည်။ Fonts load ပြီးချိန်နှင့် viewport resize အချိန်တွင် ပြန်တွက်သည်။ အမည်များကို initials/ellipsis/line clamp ဖြင့် မဖြတ်ပါ။ ပထမ 3D စာမျက်နှာတွင် **ပထမအမည်အပြည့်အစုံ → နှင့်/connector → ဒုတိယအမည်အပြည့်အစုံ** အပေါ်အောက်ပြထားသည်။ Body text ကို အနည်းဆုံး 12px နှင့် full-name text ကို အနည်းဆုံး 14px ထားသည်။ အကန့်အသတ်မရှိရှည်သောစာသားအားလုံးကို ဖုန်းသေးတစ်မျက်နှာအတွင်း readable အဖြစ် fit လုပ်နိုင်သည်ဟု မအာမခံပါ။ Minimum size ဖြင့်ပင် မဆံ့သော copy ကို QA အတွက် `data-fit="oversize"` ဟု ခွဲပြထားပြီး `ready` ဟု မမှားယွင်းသတ်မှတ်ပါ။

ဒုတိယစာမျက်နှာကို ပေးထားသော ရိုးရာပုံနှိပ်ဖိတ်စာ reference ကဲ့သို့ single-column hierarchy ဖြင့် ပြန်စီထားသည် — ခေါင်းစဉ်၊ ပထမမိသားစု၏ ပေးထားသောမိဘအမည်နှင့် သက်ဆိုင်သူအမည်၊ ချိတ်ဆက်အလှဆင်၊ ဒုတိယမိသားစု၏မိဘအမည်နှင့် သက်ဆိုင်သူအမည်၊ ဖိတ်ကြားစာသား၊ နေ့ရက်/အချိန်/နေရာ အစဉ်လိုက်ဖြစ်သည်။ ရှိပြီးသား venue၊ event date/time ကို ကတ်ပေါ်တွင် ပြသည်။ Empty optional fields ကို ချန်ထားပြီး မပေးထားသော နေရာ/အိမ်လိပ်စာ/မိဘအမည်ကို မခန့်မှန်းပါ။ Google Maps HTTPS URL အမှန်ပေးထားမှ map action ပြသည်။ Venue စာသားတစ်ခုတည်းမှ map link သို့မဟုတ် embed ကို မဖန်တီးပါ။

ဤ update သည် invitation renderer၊ scoped name/card CSS၊ fitting hook နှင့် tests/documentation ကိုသာ ပြောင်းသည်။ Approved dashboard/editor၊ full-name fields၊ 3D motion hook၊ published-only heart-silhouette QR၊ repository၊ Supabase migration/security နှင့် existing customer records ကို မပြောင်းပါ။ **Live database ကို မရေး/မဖျက်/မရွှေ့ထားပါ။**

စစ်ဆေးမှု: `bun run build` / `bun run typecheck` / `bun run test` အောင်မြင်သည် — **၃၈ tests / ၄၁၇ assertions**။ Long-name/wording synthetic fixtures၊ optional parent/event fields၊ valid/invalid/empty map URLs၊ full names နှင့် unchanged QR/security tests ပါဝင်သည်။ ဒီဇိုင်းသုံးမျိုးကို 320px small-screen အပါအဝင် mobile/desktop responsive frames တွင် စစ်ထားပြီး 320×568၊ 375×667၊ 390×600/844၊ 768×1024 နှင့် 1280×720 အရွယ်များကို အသုံးပြုထားသည်။ Tested cards တွင် venue/date/time မြင်ရခြင်း၊ fitted card height၊ text bounds၊ document overflow၊ စာအိတ်ဖွင့်/page-turn နှင့် gallery သုံးကြိမ်ဆက်တိုက် ပြန်ဖွင့်/ပိတ်နိုင်ခြင်းကို စစ်ထားသည်။ Browser responsive frame စမ်းသပ်မှုဖြစ်ပြီး physical-device compatibility / authenticated live Supabase E2E အပြည့်အစုံ မဟုတ်ပါ။ နောက်ဆုံး mobile screenshots တွင် နမူနာအမည်နှင့် flat-colour synthetic image သာ အသုံးပြုထားသည်။

## အမည်အပြည့်အစုံနှင့် Heart QR

ဖိတ်စာများတွင် `M & T` ကဲ့သို့ static initials/monograms မသုံးတော့ပါ။ ရှိပြီးသား `person_a` / `person_b` fields ကို **full name / အမည်အပြည့်အစုံ** ဟု label ပြထားပြီး covers၊ envelope letter၊ 3D scene၊ formal invitation၊ photo placeholders နှင့် gallery heading များတွင် ဖြည့်ထားသောအမည်အပြည့်အစုံကို သုံးသည်။ Wax seal သည် စာလုံးအတိုကောက်အစား အလှဆင် heart ဖြစ်သည်။ အမည်မဖြည့်ရသေးလျှင် neutral placeholder သာပြပြီး အမည်အသစ် မခန့်မှန်းပါ။ Stored customer names/records ကို မပြောင်းထားပါ။

Publish အောင်မြင်ပြီး actual share key ရမှ **Share link & heart QR** dialog အလိုအလျောက်ပေါ်သည်။ Published project ၏ actions menu မှလည်း ပြန်ဖွင့်နိုင်သည်။ Draft/revoked project သို့မဟုတ် share key မရှိသော project အတွက် QR မပေးပါ။

- QR တွင် Copy/Open link နှင့်တူညီသော **final share URL အတိအကျ** ကိုသာ encode လုပ်သည်။ Third-party QR service မခေါ်ပါ။
- **အပြင်ဘက် heart outline/frame မပါပါ။** Reference ကဲ့သို့ အနီရောင် QR modules များကိုယ်တိုင် heart silhouette ဖြစ်သည်။ Canonical QR matrix ကို 225° လှည့်ထား၍ finder eyes သုံးခုသည် ဘယ်၊ ညာနှင့် အောက်ထိပ်တွင် ရှိသည်။ အပေါ်ဘက် lobes နှစ်ခုကို data-derived decorative modules များဖြင့် ဆက်ဖွဲ့ထားသည်။ Payload/data/finder တစ်ကွက်မျှ မဖြတ်/မဖုံးဘဲ **H maximum error correction** နှင့် rotated four-module white quiet zone အပြည့်ကို ထိန်းထားသည်။ အဖြူရောင် diagonal bands များသည် ထို quiet zone ဖြစ်ပြီး အလှဆင် modules မဝင်ပါ။
- Download သည် **3000 × 3000 PNG** ဖြစ်သည်။ Browser က export လုပ်ပြီးသော PNG Blob ကို ပြန်ဖွင့်၍ **ပုံအပြည့်** ကို independent `jsQR` decoder ဖြင့် ပြန်ဖတ်ပြီး exact URL တူမှ download ကို enable လုပ်သည်။ QR core ကို crop လုပ်၍သာ စစ်ခြင်း မဟုတ်ပါ။ Scan verification မအောင်မြင်လျှင် download မပေးဘဲ retry/copy-link fallback ပြသည်။ QR ကို ထိ၍ image အကြီးကို ကြည့်နိုင်သည်။
- QR မထုတ်မီ/ထုတ်ပြီးနောက်၊ copy/download မလုပ်မီနှင့် tab သို့ ပြန်ရောက်ချိန်တွင် လက်ရှိ project status/key ကို ပြန်စစ်သည်။ အခြား tab မှ revoke/edit လုပ်ထားလျှင် stale share UI ကို ပိတ်/refresh လုပ်သည်။ Edit/save သို့မဟုတ် revoke က QR အဟောင်းကို ပိတ်မည်။ Republish လုပ်ပြီး QR အသစ်ကို ပြန် download လုပ်ပါ။
- **ပုံနှိပ်မည့် QR ကို permanent domain/hosting ချိတ်ပြီးမှ ထုတ်ပါ။** လက်ရှိ preview သည် ယာယီဖြစ်၍ ထို origin ကို encode လုပ်ထားသည့် QR သည် preview ရပ်သွားလျှင် အလုပ်မလုပ်တော့ပါ။ White border ကို မဖြတ်ပါနှင့်။ တကယ်ပုံနှိပ်မည့်အရွယ်၌ ဖုန်းဖြင့် scan ပြန်စမ်းပါ။

### Full-name / QR verification

Build/typecheck နှင့် tests **၃၄ ခု / assertions ၃၆၉ ခု** pass။ Independent decoder ဖြင့် generated red heart-silhouette PNG အပြည့်ကို 3000/1000/800/600/480/400px widths၊ long supported usernames/keys နှင့် hosting origins မတူသည့် links များအတွက် ပြန်ဖတ်စစ်ထားသည်။ Browser Download button မှ အမှန်တကယ်ရရှိသော 3000 × 3000 PNG အပြည့်ကို **jsQR နှင့် OpenCV** decoder နှစ်မျိုးဖြင့် ထပ် decode လုပ်၍ exact published demo URL တူကြောင်း စစ်ထားသည်။ Pixel-level test က rotated canonical matrix တစ်ကွက်ချင်းနှင့် white quiet-zone လေးကွက်အပြည့်ကို စစ်သည်။ Key patterns ရှစ်မျိုး၊ dense/long URLs နှင့် host မတူသည့် links များကိုလည်း scan စမ်းထားသည်။ Outline/frame သို့ ပြန်သုံးသည့် fallback မရှိပါ။ Draft/revoked gating၊ republish key အသစ်၊ four-module quiet zone နှင့် templates သုံးမျိုးလုံး၏ full names/escaping ကို tests ဖြင့် စစ်သည်။

သီးခြား **local demo only** တွင် full-name intake → photo upload → publish → automatic QR → PNG download → exact public view၊ external revoke simulation နှင့် stale-copy guard၊ republish QR အသစ်တို့ကို စမ်းထားသည်။ Full-name templates သုံးမျိုးကို desktop preview တွင် စစ်ပြီး 375/390/480/768px responsive frames တွင် horizontal overflow မရှိကြောင်း၊ mobile gallery ငါးကြိမ် ဆက်တိုက်ဖွင့်/ပိတ်နိုင်ကြောင်း စစ်ထားသည်။ ယခင် heart-silhouette update တွင် QR component/helper/CSS/tests/documentation ကိုသာ ပြောင်းထားပြီး dashboard/full-name/3D/Supabase source checksums မပြောင်းကြောင်း စစ်ထားသည်။ 390px mobile dialog တွင် Myanmar/English နှစ်မျိုးလုံး၊ square image နှင့် horizontal overflow မရှိခြင်းကို စစ်ထားသည်။ QR/screenshots မှ နမူနာများသည် စမ်းသပ်အမည်/flat-colour test image သာဖြစ်ပြီး real customer records မဟုတ်ပါ။ Physical phone/camera/printer compatibility အပြည့်အစုံ သို့မဟုတ် authenticated live-Supabase E2E စမ်းသပ်မှု မဟုတ်ပါ။ Database/schema/security၊ existing customer records နှင့် 3D interaction engine ကို မပြောင်းထားပါ။

QR implementation references: [DENSO WAVE — four-module quiet zone](https://www.qrcode.com/en/howto/code.html)၊ [node-qrcode — H error correction and browser API](https://github.com/soldair/node-qrcode)။

## မူလ 3D ဖိတ်စာ ပြန်လည်ထည့်သွင်းမှု

Customer-facing renderer ကိုသာ မူလ `/workspace/thazin-invitation` နှင့် legacy template source အတိုင်း ပြန်တည်ဆောက်ထားသည်။ Approved dashboard၊ Burmese/English navigation၊ editor၊ repository၊ Supabase migrations/security နှင့် customer records ကို မပြောင်းထားပါ။

- Wax-seal ကို ထိ/ဆွဲ၍ ဖွင့်ခြင်း → flap လှန်ခြင်း → invitation card ကို တဖြည်းဖြည်းဆွဲထုတ်ခြင်း → စာအုပ်ပုံစံသို့ ချောမွေ့စွာ ပြောင်းခြင်း။ ဓာတ်ပုံ/စာအိတ် bounce နှင့် pointer parallax ပါသည်။
- Paper book တွင် drag/swipe နှင့် keyboard/arrow navigation၊ 7-strip curl/shadow၊ cancel/reverse နှင့် rewrap/reopen ပါသည်။ Invitation၊ event calendar/countdown၊ schedule၊ venue map နှင့် memories စာမျက်နှာများ ပါဝင်သည်။
- **Thazin** — မူလ paper-floral arch ထောင်တက်သည့် scene။ **Golden Vow** — Art Deco သုံးဖက်ခေါက် ဓာတ်ပုံဘောင်။ **Rose Reverie** — layered paper-blossom photo scene။ သုံးမျိုးလုံးတွင် pop-up replay နှင့် full book experience ပါသည်။ Theme လေးမျိုးကို ဆက်သုံးနိုင်သည်။
- Full-screen gallery ကို စာအိတ်၊ စာအုပ်နှင့် album မှ ထပ်ခါတလဲလဲ ဖွင့်/ပိတ်နိုင်ပြီး photo swipe၊ thumbnail၊ keyboard နှင့် focus restoration ပါသည်။ Real customer ဖိတ်စာတွင် ကိုယ်ပိုင် photos မရှိပါက placeholder သာပြသည်။ Bundled နမူနာပုံများသည် labelled design samples တွင်သာ ပေါ်သည်။
- Event date/month/year ကို project data မှ တွက်ချက်သည်။ Countdown နှင့် ICS export သည် Myanmar `+06:30` time ကို အသုံးပြုသည်။ Venue iframe ကို Google Maps URL အဖြစ်သာ ဆောက်၍ venue page ရောက်မှ lazy-load လုပ်သည်။
- React StrictMode နှင့် unmount တွင် event listeners၊ drag overlays၊ timers၊ RAF နှင့် gallery lifecycle ကို cleanup လုပ်သည်။ Reduced-motion preference ကို လေးစားသည်။ မူလ source assets/CSS ကို invitation root အောက်တွင်သာ scope လုပ်ထားသည်။

### Restoration စမ်းသပ်ချက်များ

`bun run build` / TypeScript အောင်မြင်ပြီး `bun run test` တွင် **၃၄ tests / ၃၆၉ assertions pass**။ Tests များတွင် design × theme combinations ၁၂ မျိုး၊ private fields မပေါ်ခြင်း၊ sample-photo boundary၊ Myanmar date/leap-year၊ ICS escaping/timezone၊ safe map URLs နှင့် existing repository/SQL security tests ပါဝင်သည်။

Browser တွင် desktop နှင့် responsive frames 375/390/768px ကို စစ်ထားသည်။ Envelope opening/extraction၊ floral/art-deco/blossom pop-ups နှင့် replay၊ native keyboard navigation၊ repeated photo open/close၊ gallery controls၊ rewrap နှင့် map lazy loading ကို စမ်းထားသည်။ Drag/swipe commit/cancel နှင့် gallery swipe ကို browser PointerEvents ဖြင့် simulation လုပ်ထားခြင်းဖြစ်ပြီး physical phone/Safari compatibility test အပြည့်အစုံ မဟုတ်ပါ။ ဤ restoration အတွက် live Supabase data ကို မရေး/မဖျက်/မရွှေ့ထားပါ။

## Professional dashboard UI

Dashboard တွင် compact sidebar၊ project table၊ status filters/search၊ customer directory/detail dialog၊ design library နှင့် responsive intake editor ကို အသုံးပြုထားသည်။ Decorative hero/stat cards မပါဝင်ပါ။ Myanmar UI အတွက် Noto Sans Myanmar ကို local font files နှင့် OFL license ပါ bundle လုပ်ထားသည်။ Design rationale နှင့် font sources ကို `DESIGN.md` တွင် ကြည့်ပါ။

Sign-in မဝင်ထားလျှင် dashboard shell နှင့် design samples ကိုသာ ကြည့်နိုင်ပြီး customer records မရယူပါ။ Sample design preview များကို database တွင် မသိမ်းပါ။ Customer email/phone ဖြင့် စုစည်းပြသသော directory သည် existing project records ပေါ်မှတွက်ချက်ထားခြင်းသာဖြစ်ပြီး database schema သို့မဟုတ် records ကို မပြောင်းပါ။

Supabase project၊ database schema/RLS၊ private storage၊ Edge Function နှင့် credentials များကို ဤ UI redesign တွင် ပြောင်းလဲ/reset/migrate မလုပ်ထားပါ။

### UI verification

- Production build၊ TypeScript နှင့် repository/SQL/renderer tests ၃၄ ခု pass။
- Supabase မချိတ်ထားသော သီးခြား local-demo server တွင် customer intake → event details → design/palette → photo upload → draft save → edit → preview → publish → copy link → public view → revoke စမ်းသပ်ထားသည်။ Revoke လုပ်ပြီးနောက် လင့်ခ်အဟောင်း မရတော့ကြောင်း၊ public view တွင် customer email မပါကြောင်း စစ်ဆေးထားသည်။
- Production preview တွင် signed-out dashboard၊ sign-in dialog နှင့် Myanmar/English navigation ကို စစ်ဆေးထားသည်။ Account အသစ်မဖန်တီးထားပါ။
- Desktop 1280px နှင့် same-origin responsive test frames 375/390/768px တွင် dashboard/editor/layout ကို စစ်ဆေးထားသည်။ ဤသည် responsive viewport စစ်ဆေးမှုဖြစ်ပြီး physical phone/browser compatibility အပြည့်အစုံ စမ်းသပ်မှုမဟုတ်ပါ။
- Port 8767 alternate preview ကို ဆက်အသုံးပြုထားသည်။ Permanent domain/hosting နှင့် Auth Site URL/redirect configuration၊ authenticated Supabase upload/publish end-to-end test မပြီးမချင်း **partially production-ready** သာဖြစ်သည်။

## စတင်ဖွင့်ရန်

```bash
bun install
test -f .env.local || cp .env.example .env.local
bun run dev
```

Local URL: `http://localhost:5173`။ Production build အတွက် `bun run build`၊ build preview အတွက် `bun run preview`၊ isolated unit tests အတွက် `bun run test` ကို အသုံးပြုပါ။ `bun.lock` ကို repository တွင် ထည့်ထားပါသည်။

## လက်ရှိရရှိနိုင်သောအရာများ

မြန်မာ/English dashboard၊ project search/status filters၊ customer intake နှင့် သီးသန့် customer notes၊ project editing၊ ဓာတ်ပုံထည့်/ဖယ်၊ unique share name၊ draft/save/publish/revoke workflow၊ wedding design သုံးမျိုး (Thazin၊ Golden Vow၊ Rose Reverie) နှင့် theme လေးမျိုး (sage၊ midnight၊ rose၊ blue) ပါဝင်သည်။ ဖိတ်စာတွင် စာအိတ်ဖွင့်ခြင်း၊ စာအုပ်စာမျက်နှာများ၊ gallery၊ မြန်မာအချိန် countdown၊ calendar download နှင့် venue map link ပါဝင်သည်။

နောက်ထပ် service အမျိုးအစားများကို `src/types.ts` ရှိ `projectTypes` registry မှ ထပ်တိုးနိုင်သည်။ Celebrations နှင့် Business ကို မရရှိသေးကြောင်း ရှင်းလင်းစွာ ပြသထားသည်။ Renderer အသစ်၊ fields နှင့် database validation ကိုလည်း အတူထပ်တိုးပေးရန် လိုအပ်သည်။

## လက်ရှိ Supabase ချိတ်ဆက်မှု

Dedicated project **`metta-invitation-studio-prod`** (`ryqnovjcrimzzwvzmzqp`, Singapore / `ap-southeast-1`) နှင့် sandbox preview ကို ချိတ်ဆက်ပြီးပါပြီ။ API URL: `https://ryqnovjcrimzzwvzmzqp.supabase.co`။ Browser configuration တွင် enabled public **publishable key** ကိုသာ သုံးထားပြီး `service_role` key ကို browser code၊ local frontend environment သို့မဟုတ် ZIP ထဲ မထည့်ထားပါ။

- မူလ invitation schema နှင့် `rpc_privileges` follow-up migration ကို live project တွင် apply လုပ်ပြီးပါပြီ။ Owner-only RPC သုံးခု၏ explicit anonymous default grants ကို ဖယ်ရှားထားပါသည်။
- `projects` နှင့် `project_photos` တွင် RLS ဖွင့်ထားပါသည်။ `project-photos` bucket သည် **private**၊ ဖိုင်တစ်ခု 4 MiB အထိ၊ JPEG/PNG/WebP သာ လက်ခံပါသည်။
- `invitation-photo` Edge Function version 1 သည် ACTIVE ဖြစ်ပြီး `verify_jwt=false` ကို ဤ function အတွက်သာ သတ်မှတ်ထားပါသည်။ Function code က matching username/share key၊ published status နှင့် photo/project ownership ကို ကိုယ်တိုင်စစ်ဆေးပါသည်။ Invalid links အတွက် 404၊ GET မဟုတ်သော request အတွက် 405 နှင့် no-store cache headers ကို အတည်ပြုထားပါသည်။
- Legacy SQLite data၊ demo project သို့မဟုတ် real customer records **မရွှေ့ထားပါ**။ မူလ production setup verification လုပ်စဉ်တွင် projects 0၊ photos 0၊ Auth users 0 ဖြစ်ခဲ့ပါသည်။ UI restoration အဆင့်တွင် live counts ကို ထပ်မစစ်/မပြောင်းထားပါ။ Owner account ကိုလည်း မဖန်တီးထားပါ။

လက်ရှိ temporary preview: https://8767-iphoc9ukmik2wj0j3ipu2-a5df5fb1.us2.manus.computer/ ။ Port **8767** မှ configured production build ကို serve လုပ်ထားပြီး browser တွင် Supabase sign-in screen ပြသကြောင်းနှင့် Cloudflare verification မပေါ်ကြောင်း စစ်ထားပါသည်။ ဤလင့်ခ်သည် **အမြဲတမ်း production hosting မဟုတ်ပါ**။

Source ZIP တွင် `.env.local` မပါဝင်ပါ။ Download လုပ်ပြီး အခြားစက်ပေါ် run မည်ဆိုလျှင် သင့် public configuration ကို ပြန်ဖြည့်ရန် လိုအပ်ပါသည်။ Configuration မပါလျှင် `LOCAL DEMO` အဖြစ် browser-only storage ကို သုံးပါမည်။ Demo data ကို cloud သို့ အလိုအလျောက် မရွှေ့ပါ။

## Production launch မတိုင်မီ လိုအပ်သေးသည်

အမြဲတမ်း domain/hosting ကို ရွေးပြီး `dist/` ကို SPA fallback ဖြင့် deploy လုပ်ရန် လိုအပ်ပါသည်။ Supabase Auth Site URL နှင့် redirect allowlist ကို သတ်မှတ်ထားသည့် domain နှင့် ကိုက်ညီအောင် ပြင်ပြီးမှ sign-up/email confirmation ကို အသုံးပြုပါ။ လက်ရှိ Auth settings တွင် email provider နှင့် sign-up ဖွင့်ထားပြီး email confirmation လိုအပ်သည်၊ သို့သော် Site URL/redirect settings ကို ဤအဆင့်တွင် **မပြောင်းထားပါ**။ User email ကို မခန့်မှန်းထားသဖြင့် owner account ဖွင့်ခြင်းနှင့် authenticated upload/publish end-to-end စမ်းသပ်မှု မလုပ်ထားပါ။

Security Advisor တွင် public share RPC ၏ anonymous `SECURITY DEFINER` warning နှင့် authenticated RPC လေးခု၏ `SECURITY DEFINER` warnings ကျန်ရှိပါသည်။ ၎င်းတို့သည် ရည်ရွယ်ထားသော share-key/owner-checked entry points ဖြစ်ပြီး owner-only RPC များကို anonymous က ခေါ်မရကြောင်း live privilege checks နှင့် API denial ဖြင့် အတည်ပြုထားပါသည်။ [Anonymous RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)၊ [authenticated RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)။

## နောက်ထပ် environment အသစ်တွင် Supabase ချိတ်ဆက်ရန်

1. Supabase project တစ်ခု ဖန်တီးပါ။
2. Clean project အသစ်အတွက် SQL Editor တွင် `supabase/migrations/202610210001_invitation_studio.sql` ပြီးနောက် `supabase/migrations/202610210002_rpc_privileges.sql` ကို အစဉ်လိုက် run ပါ။ လက်ရှိ dedicated project တွင် နှစ်ခုလုံး apply လုပ်ပြီးဖြစ်၍ ပြန် run ရန် မလိုပါ။ CLI ဖြင့် remote migration history ကို စီမံမည်ဆိုလျှင် tool-generated remote version IDs နှင့် local filenames ကို အရင်ညှိရန် လိုအပ်ပါသည်။
3. Private photo delivery အတွက် Edge Function ကို deploy ပါ။

```bash
supabase functions deploy invitation-photo --no-verify-jwt
```

Function သည် share username + random key + published status ကို request တစ်ခုချင်းစီ စစ်ဆေးပြီး private bucket မှ ဓာတ်ပုံကို ထုတ်ပေးသည်။ Default JWT verification ကို ပိတ်ခြင်းသည် ဤ function အတွက်သာဖြစ်ပြီး token validation ကို function အတွင်း ပြုလုပ်သည်။ Function deployment သည် public invitation photo ပြသရန် လိုအပ်သည်။

4. `.env.local` တွင် သင့် project အချက်အလက်ကို ထည့်ပါ။

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
STUDIO_ADMIN_USER_ID=EXISTING_OWNER_AUTH_UUID
APP_ORIGIN=https://love-birds-mm.vercel.app
```

5. Dev server ကို restart ပြုလုပ်ပါ။ Production တွင် variables ထည့်ပြီး **ပြန် build** လုပ်ပါ။ `VITE_` variables သည် browser bundle ထဲ ပါဝင်မည်ဖြစ်၍ `service_role` key ကို မည်သည့်အခါမျှ မထည့်ပါနှင့်။
6. Supabase Auth တွင် email/password sign-in ကို ဖွင့်ထားပြီး အသုံးပြုသူ account ဖွင့်/ဝင်ပါ။ Email confirmation ဖွင့်ထားလျှင် အီးမေးလ်တွင် အတည်ပြုပေးရမည်။ Auth URL Configuration တွင် သင့် deployed origin ကို သတ်မှတ်ပေးပါ။

**RLS** က owner တစ်ဦးချင်း project၊ customer private fields နှင့် ဓာတ်ပုံများကို ခွဲခြားကာကွယ်သည်။ Public invitation RPC က customer email၊ ဖုန်းနှင့် notes ကို မထုတ်ပေးပါ။ Photo bucket ကို public အဖြစ် မပြောင်းပါနှင့်။ Share revoke သည် နောက်ထပ် link/photo request ကို ပိတ်ပေးနိုင်သော်လည်း တစ်စုံတစ်ဦးက ကြိုတင်ကြည့်ပြီး screenshot/download သိမ်းထားသည့်အရာကို ပြန်ဖျက်ပေးနိုင်မည် မဟုတ်ပါ။

## မူလ SQLite data များ

မူလ source backup: `/workspace/invitation-studio-legacy`။ မူလ data: `/workspace/invitation-studio-data`။ Rebuild သည် မူလ SQLite database နှင့် uploaded photo files ကို မဖျက်/မပြောင်းထားပါ။ အသုံးပြုသူညွှန်ကြားချက်အရ data ကို Supabase သို့ မရွှေ့ထားပါ။

Server-side import script သည် workspace တစ်ခုချင်းကို Supabase Auth user တစ်ဦးသို့ ရွှေ့နိုင်ပြီး default သည် **dry run** ဖြစ်ပါသည်။ မတူသော customer workspaces အားလုံးကို ပေါင်းမတင်ပါ။ မူလ workspace ID ကို သိရှိသူက သက်ဆိုင်ရာ owner ကိုသာ ရွေးချယ်သင့်ပါသည်။

```bash
bun scripts/migrate-sqlite.ts --workspace=LEGACY_WORKSPACE_ID
# Import အမှန်မလုပ်မီ server-only environment variables သတ်မှတ်ပါ:
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_OWNER_ID
bun scripts/migrate-sqlite.ts --workspace=LEGACY_WORKSPACE_ID --apply
```

Import ပြီးသော ဖိတ်စာအားလုံးကို **private draft** အဖြစ်ထားပြီး လင့်ခ်အဟောင်းကို မကူးယူပါ။ Review လုပ်ပြီး ပြန် publish ပေးရမည်။ Script ကို frontend bundle ထဲ import မလုပ်ပါနှင့်။ လက်ရှိ data migration သည် live Supabase တွင် မစမ်းသပ်ရသေးပါ။

## Hosting

`bun run build` မှ ထွက်သော `dist/` နှင့် `api/studio.ts` server function နှစ်ခုလုံးကို Vercel ပေါ်တင်ရန် လိုသည်။ Static-only hosting ဖြင့် cloud features အလုပ်မလုပ်ပါ။ `/i/:username?key=...` deep links အတွက် SPA fallback to `index.html` လိုအပ်သည်။ Netlify/Cloudflare Pages အတွက် `public/_redirects`၊ Vercel အတွက် `vercel.json` ပါဝင်သည်။ အခြား host များတွင် အလားတူ rewrite ကို သတ်မှတ်ပါ။

## ဖိုင်ဖွဲ့စည်းပုံ

- `src/App.tsx` — dashboard၊ auth၊ public route
- `src/components/Editor.tsx` — customer intake၊ design၊ photos၊ publish
- `src/components/Invitation.tsx` — pure React 3D invitation
- `src/components/TraditionalCard.tsx` / `traditional-card.css` — single-column Myanmar formal card
- `src/components/invitation-names.css` — full-name stacking / vertical reading safeguards
- `src/components/ShareDialog.tsx` — published-only share/verified QR dialog
- `src/lib/shareQr.ts` — exact link builder၊ H-level red heart-silhouette PNG နှင့် scan verification
- `src/lib/repository.ts` — Supabase / demo storage data layer
- `src/types.ts` — shared types နှင့် project registry
- `supabase/migrations/` — schema၊ RLS၊ RPC နှင့် storage policies
- `supabase/functions/invitation-photo/` — token-gated private photo proxy
- `scripts/migrate-sqlite.ts` — မူလ data import (dry-run-first)
- `tests/` — Bun unit tests

Supabase Auth၊ RLS၊ Storage နှင့် environment configuration များ၏ အခြေခံ reference: [Supabase React guide](https://supabase.com/docs/guides/getting-started/tutorials/with-react)။

## စမ်းသပ်ထားသောအရာများ

`bun run build` နှင့် `bun run typecheck` အောင်မြင်သည်။ `bun run test` ဖြင့် configured environment ကို ပိတ်၍ Bun tests **၃၄ ခု / assertions ၃၆၉ ခု** တွင် validation၊ generated usernames၊ photo count limits၊ publish/edit/revoke၊ private customer data ဖျောက်ထားမှု၊ storage quota rollback နှင့် SQL owner isolation/publication တို့ကို စမ်းသပ်ထားသည်။ SQL test သည် local PostgreSQL-compatible PGlite တွင် Supabase `auth`/`storage` schema နမူနာဖြင့် run ထားခြင်းဖြစ်ပြီး live Supabase service ကို စမ်းသပ်ထားခြင်း မဟုတ်ပါ။ Browser တွင် intake → photo upload → 3D preview → publish → public invitation → revoke workflow နှင့် 390px mobile layout overflow ကိုလည်း စစ်ဆေးထားသည်။

Production setup အဆင့်တွင် live Supabase RLS flags၊ private bucket settings၊ owner RPC privilege boundary နှင့် project/photo/user counts ကို စစ်ထားပါသည်။ Public API ဖြင့် anonymous table read/owner RPC denial၊ nonexistent public invitation နှင့် deployed photo-function rejection paths ကို စစ်ထားပြီး data မရေးထားပါ။ Valid authenticated upload/publish ကို owner account မရှိသဖြင့် live မစမ်းသပ်ရသေးပါ။
