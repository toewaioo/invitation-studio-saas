import type { Language, ScheduleMilestone } from '../types';
import './wedding-schedule.css';
export default function ScheduleEditor({value, lang, onChange}: {value?: ScheduleMilestone[]; lang: Language; onChange: (value: ScheduleMilestone[]) => void}) {
  const items = value || [];
  const t = (en: string, my: string) => lang === 'en' ? en : my;
  const update = (index: number, field: keyof ScheduleMilestone, text: string) => onChange(items.map((item, i) => i === index ? {...item, [field]: text} : item));
  return <fieldset className="schedule-editor full-width"><legend>{t('Wedding-day schedule', 'မင်္ဂလာနေ့ အစီအစဉ်')}</legend>
    <p>{t('Add up to four milestones. Only these times appear on the invitation; no sample times are added automatically.', 'အစီအစဉ် ၄ ခုအထိ ထည့်နိုင်ပါသည်။ ဤအချိန်များကိုသာ ဖိတ်စာတွင် ပြပါမည်။ နမူနာအချိန်များကို အလိုအလျောက် မထည့်ပါ။')}</p>
    {items.map((item, i) => <div className="schedule-editor-row" key={i}>
      <label>{t(`Time ${i+1} (Myanmar)`, `အချိန် ${i+1} (မြန်မာအချိန်)`)}<input name={`schedule-time-${i}`} type="time" required value={item.time} onChange={e => update(i, 'time', e.target.value)}/></label>
      <label>{t(`Milestone ${i+1}`, `အစီအစဉ် ${i+1}`)}<input name={`schedule-label-${i}`} required maxLength={100} value={item.label} onChange={e => update(i, 'label', e.target.value)}/></label>
      <button type="button" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label={t(`Remove milestone ${i+1}`, `အစီအစဉ် ${i+1} ဖယ်ရန်`)}>×</button>
    </div>)}
    <button type="button" disabled={items.length >= 4} onClick={() => onChange([...items, {time:'', label:''}])}>{t('Add milestone', 'အစီအစဉ် ထည့်ရန်')} ({items.length}/4)</button>
  </fieldset>;
}
