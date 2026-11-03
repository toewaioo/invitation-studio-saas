import { useRef } from 'react';
import useCardFit from './useCardFit';
import type { Design, ProjectInput } from '../types';
import { calendarFor, invitationDate, venueMap } from './invitationData';
import ParentText from './ParentText';

type CardData = Pick<ProjectInput, 'parent_a' | 'parent_b' | 'message' | 'event_date' | 'venue' | 'map_url'>;
interface Props { project: CardData; firstName: string; secondName: string; sprigHref: string; sample?: boolean; design?: Design }

/** A single reading column, like a printed Myanmar wedding card. All personal
 * details come from the supplied fields; no gender, degree, address or relatives
 * are inferred. Optional empty rows do not leave placeholders or blank columns.
 */
export default function TraditionalCard({ project, firstName, secondName, sprigHref, sample, design = 'thazin' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useCardFit(ref, JSON.stringify([project, firstName, secondName, sample, design]));
  const map = venueMap(project.venue, project.map_url);
  const parentA = project.parent_a?.trim();
  const parentB = project.parent_b?.trim();
  const validDate = calendarFor(project.event_date);
  const venue = project.venue?.trim();
  return <div ref={ref} className="traditional-card">
    <svg className="traditional-corner traditional-corner-left" viewBox="0 0 150 190" aria-hidden="true"><use href={sprigHref}/></svg>
    <svg className="traditional-corner traditional-corner-right" viewBox="0 0 150 190" aria-hidden="true"><use href={sprigHref}/></svg>
    <header className="traditional-heading" data-title-style={design}>
      <h1>မင်္ဂလာဧည့်ခံပွဲ ဖိတ်ကြားလွှာ</h1>
      <div className="traditional-rule" aria-hidden="true"><i/><span>❧</span><i/></div>
    </header>
    <div className="traditional-families">
      <section className="traditional-family" aria-label="ပထမမိသားစု">
        {parentA && <p className="traditional-parents"><ParentText value={parentA}/></p>}
        <h2 className="traditional-person">{firstName}</h2>
      </section>
      <div className="traditional-union" aria-label="နှင့်"><span aria-hidden="true">♡</span><span>နှင့်</span><span aria-hidden="true">♡</span></div>
      <section className="traditional-family" aria-label="ဒုတိယမိသားစု">
        {parentB && <p className="traditional-parents"><ParentText value={parentB}/></p>}
        <h2 className="traditional-person">{secondName}</h2>
      </section>
    </div>
    <div className="traditional-rule traditional-rule-small" aria-hidden="true"><i/><span>❧</span><i/></div>
    {project.message?.trim() && <p className="traditional-wording">{project.message.trim()}</p>}
    {(validDate || venue) && <dl className="traditional-event">
      {validDate && <div className="traditional-date"><dt>နေ့ရက်</dt><dd><time dateTime={project.event_date}>{invitationDate(project.event_date)}</time></dd></div>}
      {venue && <div className="traditional-location"><dt>နေရာ</dt><dd className="traditional-venue">{venue}</dd></div>}
    </dl>}
    {map.href && <a className="traditional-map-link" href={map.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">မြေပုံကြည့်ရန် ↗</a>}
    <div className="traditional-endmark" aria-hidden="true">❧</div>
    {sample && <p className="paper-footnote">ဒီဇိုင်းသရုပ်ပြ နမူနာဖိတ်စာ</p>}
  </div>;
}
