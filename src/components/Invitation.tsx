import { useCallback, useId, useMemo, useRef, type CSSProperties } from "react";
import type { Photo, Project } from "../types";
import { getInvitationTemplate } from "../templates/registry";
import TemplatePopups from "../templates/scenes/TemplatePopups";
import useInvitationMotion from "./useInvitationMotion";
import DayCountdown from "./DayCountdown";
import {
  calendarFor,
  invitationDate,
  myDigits,
  text,
  venueMap,
} from "./invitationData";
import TraditionalCard from "./TraditionalCard";
import VenueMiniMap from "./VenueMiniMap";
import { visibleSchedule, scheduleTime } from "../lib/schedule";
import "./wedding-schedule.css";
import PaperFiligree from "./PaperFiligree";
import "./invitation.css";
import "./invitation-names.css";
import "./traditional-card.css";
import "./one-screen.css";
import "./invitation-ornate.css";
import "./invitation-opening.css";
import "./invitation-formal.css";

type Props = { project: Project; preview?: boolean; onClose?: () => void };
const SAMPLE_PHOTOS: Photo[] = [1, 2, 3].map((n, position) => ({
  id: `sample-${n}`,
  url: `/assets/wedding-${n}.jpg`,
  caption: "ဒီဇိုင်းသရုပ်ပြ နမူနာဓာတ်ပုံ",
  position,
}));
const PAGE_COUNT = 6;

/** Original paper-theatre DOM, populated only with this invitation's public fields. */
export default function Invitation({
  project,
  preview = false,
  onClose,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const sprigId = `invitation-sprig-${useId().replace(/:/g, "")}`;
  const openingInstructionsId = `${sprigId}-instructions`;
  const sample = preview && project.id === "design-preview";
  const photos = useMemo(
    () =>
      sample && !project.photos.length
        ? SAMPLE_PHOTOS
        : [...project.photos].sort((a, b) => a.position - b.position),
    [project.photos, sample],
  );
  const calendar = calendarFor(project.event_date);
  const map = venueMap(project.venue, project.map_url);
  const schedule = visibleSchedule(project.schedule);
  const venue = project.venue?.trim();
  const firstName = text(project.person_a, "အမည် မထည့်ရသေးပါ");
  const secondName = text(project.person_b, "အမည် မထည့်ရသေးပါ");
  const names = `${firstName} & ${secondName}`;
  const stamp = calendar
    ? `${String(calendar.day).padStart(2, "0")} · ${String(calendar.month).padStart(2, "0")} · ${calendar.year}`
    : "WITH LOVE";
  const template = getInvitationTemplate(project.template);
  const design = template.id;
  const arrivalPhoto = photos[Math.min(2, photos.length - 1)];
  // Event time is planning-only. The calendar uses an independent date-only
  // countdown; no timed calendar export is exposed to guests.
  const downloadCalendar = useCallback(() => {}, []);
  useInvitationMotion(
    root,
    photos,
    project.event_date,
    "",
    downloadCalendar,
  );

  const namePair = (className = "name-pair") => (
    <span className={className}>
      <span>{firstName}</span>
      <i aria-hidden="true">&</i>
      <span>{secondName}</span>
    </span>
  );
  const sprig = (className: string) => (
    <svg className={className} viewBox="0 0 150 190" aria-hidden="true">
      <use href={`#${sprigId}`} />
    </svg>
  );
  const portrait = (photo: Photo | undefined) =>
    photo ? (
      <img
        src={photo.url}
        alt={photo.caption || "မင်္ဂလာအမှတ်တရ ဓာတ်ပုံ"}
        draggable={false}
      />
    ) : null;

  return (
    <main
      ref={root}
      className={`invite sealed invite-design-${design} invite-theme-${project.theme || "sage"}`}
      data-design={design}
      data-theme={project.theme || "sage"}
      aria-label="Wedding invitation"
    >
      {preview && onClose && (
        <button
          type="button"
          className="invite-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          ×
        </button>
      )}
      <div className="table-light" aria-hidden="true" />
      <div className="silk-ribbon ribbon-one" aria-hidden="true" />
      <div className="silk-ribbon ribbon-two" aria-hidden="true" />
      <div className="floating-petals" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${7 + i * 11}%`,
              top: "-30px",
              animationDelay: `${-i * 3.7}s`,
              animationDuration: `${23 + i * 1.7}s`,
            }}
          />
        ))}
      </div>
      <svg className="botanical-defs" aria-hidden="true">
        <defs>
          <g id={sprigId} fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M10 180Q35 90 112 12M34 117Q3 88 12 61M51 91Q39 48 61 21M70 67Q103 80 137 60M89 43Q117 44 135 25" />
            <g fill="currentColor" stroke="none" opacity=".28">
              <ellipse
                cx="17"
                cy="78"
                rx="8"
                ry="23"
                transform="rotate(-25 17 78)"
              />
              <ellipse
                cx="29"
                cy="109"
                rx="7"
                ry="21"
                transform="rotate(-45 29 109)"
              />
              <ellipse
                cx="51"
                cy="57"
                rx="7"
                ry="24"
                transform="rotate(10 51 57)"
              />
              <ellipse
                cx="65"
                cy="79"
                rx="7"
                ry="22"
                transform="rotate(48 65 79)"
              />
              <ellipse
                cx="110"
                cy="69"
                rx="8"
                ry="23"
                transform="rotate(75 110 69)"
              />
              <ellipse
                cx="119"
                cy="34"
                rx="6"
                ry="18"
                transform="rotate(60 119 34)"
              />
            </g>
          </g>
        </defs>
      </svg>

      <div className="cover-atmosphere" aria-hidden="true">
        {sprig("cover-botanical cover-botanical-left")}
        {sprig("cover-botanical cover-botanical-right")}
      </div>
      <div className="invitation-experience">
        <div className="arrival" id="arrival" data-has-photo={photos.length > 0}>
          <span className="arrival-crest" aria-hidden="true"><i /><b>❧</b><i /></span>
          <p className="arrival-overline">{template.arrival.eyebrow}</p>
          <p className="handwritten">{template.arrival.title}</p>
          <p className="to-guest">
            <span>{firstName}</span><i>&</i><span>{secondName}</span>
          </p>
          <div className="envelope-scene">
            <div className="keepsake-depth">
              <button
                type="button"
                className="arrival-photo"
                id="arrival-photo"
                hidden={!photos.length}
                data-photo-index={
                  arrivalPhoto ? photos.indexOf(arrivalPhoto) : undefined
                }
                disabled={!photos.length}
                aria-label="View envelope photo"
              >
                <div className="arrival-photo-arch">
                  {portrait(arrivalPhoto)}
                </div>
                <span>The beginning of forever</span>
                <small>
                  {photos.length
                    ? "ပုံလေးကို ထိပြီး အကြီးကြည့်ပါ ↗"
                    : "မေတ္တာနဲ့ စတင်တဲ့ အမှတ်တရ"}
                </small>
              </button>
              {sprig("arrival-flower")}
              <div className="envelope" id="envelope">
                <div className="envelope-back" />
                <div className="letter-peek">
                  <span>မင်္ဂလာဖိတ်ကြားလွှာ</span>
                  <div className="peek-names">
                    {namePair()}
                  </div>
                  <small>{stamp}</small>
                  <i className="peek-flourish" aria-hidden="true">
                    ❧
                  </i>
                </div>
                <div className="envelope-flap" />
                <div className="envelope-front" />
                {sprig("envelope-sprig")}
                <div className="envelope-address">
                  <span>အမှတ်တရ နေ့ရက်လေးအတွက်</span>
                  <p>မေတ္တာဖြင့် ဖိတ်ခေါ်ပါရစေ</p>
                </div>
                <div className="opening-petals" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => (
                    <i key={i} style={{
                      "--petal-x": `${(i % 2 ? 1 : -1) * (34 + (i % 6) * 17)}px`,
                      "--petal-y": `${-105 - (i % 5) * 30}px`,
                      "--petal-spin": `${(i % 2 ? 1 : -1) * (95 + i * 23)}deg`,
                      "--petal-delay": `${i * 65}ms`,
                    } as CSSProperties} />
                  ))}
                </div>
                <button
                  type="button"
                  id="open-envelope"
                  className="wax-seal"
                  aria-label="Open invitation"
                  aria-describedby={openingInstructionsId}
                >
                  <span className="seal-heart" aria-hidden="true">♥</span>
                  <span className="seal-fragment seal-fragment-left" aria-hidden="true"><i>♥</i></span>
                  <span className="seal-fragment seal-fragment-right" aria-hidden="true"><i>♥</i></span>
                  <span className="seal-crack" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <p className="open-whisper" id={openingInstructionsId}>
            တံဆိပ်ကို ထိ / ဆွဲ၍ ဖွင့်ပါ
            {photos.length > 0 && " · ပုံကိုထိ၍ အကြီးကြည့်ပါ"}
          </p>
          {calendar && <span className="arrival-date">
            {invitationDate(project.event_date)}
          </span>}
        </div>

        <div className="reading-room" id="reading-room" hidden>
          <div className="book-scene" id="book-scene">
            <div className="book" id="book">
              <div className="left-leaf">
                <div className="left-inner">
                  {sprig("paper-sprig left-sprig")}
                  <p className="tiny-caps">THE WEDDING OF</p>
                  <button
                    type="button"
                    className="portrait-frame desktop-photo"
                    hidden={!photos.length}
                    data-photo-index={photos.length ? 0 : undefined}
                    disabled={!photos.length}
                    aria-label="View wedding portrait"
                  >
                    {portrait(photos[0])}
                    <span className="photo-tape" />
                  </button>
                  <p className="photo-handwriting">
                    Together, a beautiful beginning.
                  </p>
                  <div className="left-names">
                    {namePair()}
                  </div>
                  {photos.length > 0 && <p className="photo-disclaimer">
                    {sample
                      ? "ဒီဇိုင်းသရုပ်ပြ နမူနာဓာတ်ပုံ"
                      : "ပုံလေးကို ထိပြီး အကြီးကြည့်နိုင်ပါသည်။"}
                  </p>}
                </div>
              </div>
              <div className="right-leaves" id="right-leaves">
                <article
                  className="paper popup-paper active"
                  data-page="0"
                  aria-label={template.arrival.heading}
                >
                  <PaperFiligree design={design} />
                  <p className="tiny-caps">{template.arrival.kicker}</p>
                  <h2>{template.arrival.heading}</h2>
                  <div
                    className="popup-stage"
                    id="popup-stage"
                    role="img"
                    aria-label={template.arrival.scene}
                  >
                    <div className="template-popups" aria-hidden="true">
                      <TemplatePopups
                        design={design}
                        photos={photos}
                        arrivalPhoto={arrivalPhoto}
                        renderPortrait={portrait}
                      />
                    </div>
                    <div className="popup-halo" />
                    <div className="popup-world">
                      <div className="popup-floor" />
                      <div className="popup-cast-shadow" />
                      <div className="popup-fold-line" />
                      <div className="popup-stand">
                        <div className="popup-arch-depth">
                          <img
                            src="/assets/paper-floral-arch.svg"
                            alt=""
                            draggable={false}
                          />
                        </div>
                        <img
                          className="popup-arch-face"
                          src="/assets/paper-floral-arch.svg"
                          alt=""
                          draggable={false}
                        />
                        <div className="popup-vows">
                          <span className="popup-heart" aria-hidden="true">♡</span>
                          <small>{stamp}</small>
                        </div>
                        <i className="popup-tab tab-left" />
                        <i className="popup-tab tab-right" />
                      </div>
                      <div className="popup-petals" aria-hidden="true">
                        {Array.from({ length: 8 }, (_, i) => (
                          <i key={i} style={{ "--i": i } as CSSProperties} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="popup-couple-names">{namePair()}</div>
                  <div className="popup-footer">
                    <p>{template.arrival.foot}</p>
                    <button
                      type="button"
                      id="popup-replay"
                      aria-label="Replay 3D pop-up"
                    >
                      <span aria-hidden="true">↻</span> ထပ်မံပွင့်လန်းကြည့်မယ်
                    </button>
                  </div>
                </article>

                <article
                  className="paper invitation-paper"
                  data-page="1"
                  hidden
                  aria-label="ဖိတ်ကြားလွှာ"
                >
                  <PaperFiligree design={design} />
                  <TraditionalCard
                    design={design}
                    project={project}
                    firstName={firstName}
                    secondName={secondName}
                    sprigHref={`#${sprigId}`}
                    sample={sample}
                  />
                </article>

                <article
                  className="paper calendar-paper"
                  data-page="2"
                  hidden
                  aria-label="မင်္ဂလာပြက္ခဒိန်"
                >
                  <PaperFiligree design={design} />
                  <div
                    className="calendar-ornament calendar-ornament--top"
                    aria-hidden="true"
                  >
                    <span>✦</span>
                    <i />
                    <span>♡</span>
                    <i />
                    <span>✦</span>
                  </div>
                  <header className="calendar-heading">
                    <p className="calendar-kicker">မင်္ဂလာအမှတ်တရ</p>
                    <h1>
                      <span>{calendar?.monthName || "အထူးနေ့ရက်လေး"}</span>
                      <strong>
                        {calendar ? myDigits(calendar.year) : "—"}
                      </strong>
                    </h1>
                    <p className="calendar-rule" aria-hidden="true">
                      <b />
                      <span>✦</span>
                      <b />
                    </p>
                  </header>
                  {calendar ? (
                    <section
                      className="calendar-grid-wrap"
                      aria-label={`${calendar.monthName} ${calendar.year}`}
                    >
                      <div className="weekday-row" aria-hidden="true">
                        {["နွေ", "လာ", "ဂါ", "ဟူး", "ကြာ", "သော", "နေ"].map(
                          (day) => (
                            <span key={day}>{day}</span>
                          ),
                        )}
                      </div>
                      <div className="date-grid">
                        {Array.from(
                          { length: calendar.start + calendar.count },
                          (_, i) =>
                            i < calendar.start ? (
                              <span key={i} className="date-cell date-empty" />
                            ) : i - calendar.start + 1 === calendar.day ? (
                              <button
                                key={i}
                                className="date-cell wedding-date"
                                id="wedding-day"
                                type="button"
                                aria-label="Wedding day"
                              >
                                <span
                                  className="heart-ring"
                                  aria-hidden="true"
                                />
                                <span>{myDigits(calendar.day)}</span>
                              </button>
                            ) : (
                              <span key={i} className="date-cell">
                                {myDigits(i - calendar.start + 1)}
                              </span>
                            ),
                        )}
                      </div>
                    </section>
                  ) : null}
                  {calendar && <section
                    className="selected-day"
                    aria-label="မင်္ဂလာရက် အသေးစိတ်"
                  >
                    <span
                      className="selected-bloom bloom-left"
                      aria-hidden="true"
                    >
                      ❧
                    </span>
                    <div className="selected-copy">
                      <p>မင်္ဂလာရက်</p>
                      <strong>
                        {calendar ? myDigits(calendar.day) : "—"}{" "}
                        <em>{calendar?.monthName || ""}</em>
                      </strong>
                    </div>
                    <span
                      className="selected-bloom bloom-right"
                      aria-hidden="true"
                    >
                      ❧
                    </span>
                  </section>}
                  <DayCountdown eventDate={project.event_date} />
                  <footer className="calendar-footer">
                    <span>တို့နှစ်ဦး၏ အစပြုရာနေ့</span>
                    <i aria-hidden="true">♥</i>
                  </footer>
                </article>

                <article
                  className="paper details-paper"
                  data-page="3"
                  hidden
                  aria-label="မင်္ဂလာနေ့ အစီအစဉ်"
                >
                  <PaperFiligree design={design} />
                  {sprig("paper-sprig top-sprig")}
                  <p className="tiny-caps">A DAY TO REMEMBER</p>
                  <h2>အမှတ်တရ နေ့ရက်လေး</h2>
                  <div className="ornament">
                    <i />❧<i />
                  </div>
                  <p className="soft-copy">
                    သင့်ရဲ့ အပြုံးလေးဟာ
                    <br />
                    ကျွန်ုပ်တို့အတွက် အလှဆုံးလက်ဖွဲ့ပါ။
                  </p>
                  {schedule.length > 0 && <section className="wedding-schedule" aria-label="မင်္ဂလာနေ့ အစီအစဉ်">
                    <h3>မင်္ဂလာနေ့ အစီအစဉ်</h3>
                    <ol className="schedule-milestones">
                      {schedule.map((milestone, index) => <li key={index}>
                        <time dateTime={milestone.time}>{scheduleTime(milestone.time)}</time>
                        <p>{milestone.label}</p>
                      </li>)}
                    </ol>
                    {sample && <p className="schedule-sample-note">နမူနာ ခန့်မှန်းအစီအစဉ်သာဖြစ်ပါသည်။</p>}
                  </section>}
                  {(venue || map.href) && <p className="venue-address">
                    {map.href ? (
                    <button
                      type="button"
                      className="venue-jump"
                      id="venue-jump"
                    >
                      {text(project.venue, "နေရာလမ်းညွှန်")} ↗
                    </button>
                    ) : <span className="venue-name">{venue}</span>}
                  </p>}
                </article>

                <article
                  className="paper directions-paper"
                  data-page="4"
                  hidden
                  aria-label="နေရာလမ်းညွှန်"
                >
                  <PaperFiligree design={design} />
                  <p className="tiny-caps">MEET US HERE</p>
                  <h2>မေတ္တာနဲ့ ဆုံကြမယ့်နေရာ</h2>
                  {venue && <p className="journey-venue">{venue}</p>}
                  <VenueMiniMap venue={project.venue} supplied={project.map_url} />
                  {map.href && (
                    <a
                      className="journey-map-button"
                      href={map.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ပွဲနေရာ မြေပုံကြည့်ရန် <span>↗</span>
                    </a>
                  )}
                  {map.href && <p className="journey-footnote">{sample ? "ဒီဇိုင်းသရုပ်ပြ နမူနာနေရာနှင့် မြေပုံသာဖြစ်သည်။" : "ပေးထားသော မြေပုံလင့်ခ်ကို ဖွင့်မည်။"}</p>}
                </article>

                <article
                  className="paper memories-paper"
                  data-page="5"
                  hidden
                  aria-label="အမှတ်တရပုံများ"
                >
                  <PaperFiligree design={design} />
                  <p className="tiny-caps">LITTLE MOMENTS, FOREVER OURS</p>
                  <h2>မေတ္တာနဲ့ သိမ်းထားမယ်</h2>
                  {photos.length ? (
                    <div
                      className={`album${photos.length > 3 ? " album-many" : ""}`}
                    >
                      {photos.map((photo, i) => (
                        <button
                          type="button"
                          key={photo.id}
                          className={`album-photo photo-${["a", "b", "c"][i % 3]}`}
                          data-photo-index={i}
                          aria-label={`View photo ${i + 1}`}
                        >
                          <img
                            src={photo.url}
                            alt={
                              photo.caption || `မင်္ဂလာအမှတ်တရ ဓာတ်ပုံ ${i + 1}`
                            }
                            draggable={false}
                          />
                          <span>
                            {photo.caption ||
                              [
                                "Our little forever",
                                "All the beautiful days",
                                "You, always",
                              ][i % 3]}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="memory-quote">
                    ဘယ်ခရီးကိုပဲ သွားသွား
                    <br />
                    မင်းနဲ့အတူဆို အိမ်ပါပဲ။
                  </p>
                  {photos.length > 0 && <p className="photo-disclaimer">
                    ပုံလေးကို ထိပြီး အကြီးကြည့်နိုင်ပါသည်။
                    {sample && (
                      <>
                        <br />
                        ပုံအားလုံးသည် ဒီဇိုင်းသရုပ်ပြ နမူနာပုံများသာဖြစ်ပါသည်။
                      </>
                    )}
                  </p>}
                </article>
              </div>
              <div className="book-spine" aria-hidden="true" />
              <div
                className="opening-cover"
                id="opening-cover"
                aria-hidden="true"
              >
                <div className="cover-face">
                  {sprig("cover-sprig")}
                  <span>မင်္ဂလာဖိတ်ကြားလွှာ</span>
                  <div className="cover-names">{namePair()}</div>
                  <p>မင်္ဂလာအမည်များ</p>
                  <small>{stamp}</small>
                </div>
                <div className="cover-back" />
              </div>
            </div>
          </div>
          <nav className="page-turner" aria-label="Invitation pages">
            <button
              type="button"
              id="prev-page"
              aria-label="Previous page"
              disabled
            >
              ←
            </button>
            <p>
              <span id="page-title">{template.arrival.heading}</span>
              <small id="page-number" aria-live="polite">
                ၁ / {myDigits(PAGE_COUNT)}
              </small>
            </p>
            <button type="button" id="next-page" aria-label="Next page">
              →
            </button>
          </nav>
          <p className="reading-whisper">
            ဘယ် / ညာ ဆွဲ၍ စာမျက်နှာလှန်ပါ
          </p>
        </div>
      </div>

      <div className="quiet-tools">
        <button type="button" id="rewrap" aria-label="Rewrap invitation" hidden>
          စာအိတ် ပြန်ပိတ်ရန်
        </button>
        <button
          type="button"
          id="keepsake-photo"
          data-photo-index={
            arrivalPhoto ? photos.indexOf(arrivalPhoto) : undefined
          }
          aria-label="View keepsake photo"
          hidden
        >
          ဓာတ်ပုံကြည့်ရန်
        </button>
        {!preview && (
          <button type="button" id="share" aria-label="Share invitation">
            မျှဝေရန်
          </button>
        )}
      </div>
      <div className="toast" id="toast" role="status" />
      <dialog id="photo-dialog" aria-label="Photo gallery">
        <header className="gallery-header">
          <span>အမှတ်တရပုံလေးများ · {names}</span>
          <button
            type="button"
            className="close-dialog"
            aria-label="Close photo"
          >
            ×
          </button>
        </header>
        <figure className="gallery-stage" id="gallery-stage">
          <img
            id="large-photo"
            src={photos[0]?.url}
            alt={photos[0]?.caption || names}
            draggable={false}
          />
        </figure>
        <div className="gallery-controls">
          <button type="button" id="gallery-prev" aria-label="Previous photo">
            ←
          </button>
          <p>
            <span id="gallery-counter" aria-live="polite">
              ၁ / {myDigits(photos.length)}
            </span>
            <small>ဘယ် / ညာ ဆွဲ၍ ပုံလှန်ကြည့်ပါ</small>
          </p>
          <button type="button" id="gallery-next" aria-label="Next photo">
            →
          </button>
        </div>
        <div className="gallery-thumbs" aria-label="Choose photo">
          {photos.map((photo, i) => (
            <button
              type="button"
              key={photo.id}
              data-gallery={i}
              aria-label={`Choose photo ${i + 1}`}
              aria-pressed={i === 0}
            >
              <img src={photo.url} alt="" draggable={false} />
            </button>
          ))}
        </div>
        <p className="gallery-disclaimer">
          {sample
            ? "ဒီဇိုင်းသရုပ်ပြ နမူနာဓာတ်ပုံများ"
            : "ချစ်ခြင်းမေတ္တာ အမှတ်တရပုံရိပ်များ"}
        </p>
      </dialog>
    </main>
  );
}
