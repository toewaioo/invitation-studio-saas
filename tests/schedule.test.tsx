import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Invitation from '../src/components/Invitation';
import { createDesignPreview } from '../src/lib/designPreview';
import { normalizeSchedule, scheduleTime } from '../src/lib/schedule';
import { localRepository } from '../src/lib/localRepository';
import { guestPublicInput } from '../src/lib/guestInvitation';
const sample = createDesignPreview('thazin', 'my');
describe('editable wedding-day schedule', () => {
  test('fixture owns all four approximate example times', () => {
    expect(sample.schedule?.map(x => x.time)).toEqual(['07:00','08:00','09:00','10:00']);
    expect(scheduleTime('07:00')).toBe('7:00 AM');
    expect(scheduleTime('00:05')).toBe('12:05 AM');
    expect(scheduleTime('12:00')).toBe('12:00 PM');
  });
  test('real invitations and owner previews never infer examples from event_time', () => {
    for (const preview of [false,true]) {
      const html = renderToStaticMarkup(<Invitation project={{...sample,id:'customer',schedule:undefined,event_time:'09:37'}} preview={preview}/>);
      expect(html).not.toContain('schedule-milestones');
      expect(html).not.toContain('7:00 AM');
      expect(html).not.toContain('09:37');
      expect(html).not.toContain('route-guidance-dialog');
    }
  });
  test('customer milestone content is editable and escaped, not fixture-driven', () => {
    const html = renderToStaticMarkup(<Invitation project={{...sample,id:'customer',schedule:[{time:'15:45',label:'<script>custom</script>'}]}}/>);
    expect(html).toContain('3:45 PM');
    expect(html).toContain('&lt;script&gt;custom&lt;/script&gt;');
    expect(html).not.toContain('7:00 AM');
    expect(html).not.toContain('နမူနာ ခန့်မှန်းအစီအစဉ်');
  });
  test('invalid schedules fail closed and input validation rejects oversized/broken entries', () => {
    for (const invalid of [null,{},[{time:'25:00',label:'Bad'}],[{time:'07:00',label:''}],Array(5).fill({time:'07:00',label:'Too many'})]) expect(() => normalizeSchedule(invalid)).toThrow();
    expect(normalizeSchedule([])).toEqual([]);
    expect(normalizeSchedule([{time:' 07:00 ',label:' Ceremony '}])).toEqual([{time:'07:00',label:'Ceremony'}]);
  });
  test('local save/get/public read preserves customer schedule and private data stays hidden', async () => {
    const p = await localRepository.save({...sample,username:'schedule-roundtrip',customer_name:'Private',event_time:'07:00'});
    expect((await localRepository.get(p.id)).schedule).toEqual(sample.schedule);
    const updated = await localRepository.save({...p,schedule:[{time:'11:30',label:'Custom reception'}]},p.id);
    expect(updated.schedule).toEqual([{time:'11:30',label:'Custom reception'}]);
    expect(guestPublicInput({...sample,event_time:'07:00'}).schedule).toEqual(sample.schedule);
    const cleared = await localRepository.save({...updated,schedule:[]},p.id);
    expect(cleared.schedule).toEqual([]);
  });
});
