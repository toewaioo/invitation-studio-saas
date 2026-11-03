import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Invitation from '../src/components/Invitation';
import { emptyProject, type Design, type Project } from '../src/types';
import { renderedParentTexts, visibleText } from './helpers/markup-text';

const fixture: Project = {
  ...emptyProject, id: 'traditional-layout-test', status: 'draft', public_key: null,
  created_at: '', updated_at: '',
  person_a: 'မောင်ပြည့်ဖြိုးအောင်မင်းခန့် နမူနာအမည်အပြည့်အစုံ',
  person_b: 'မနှင်းသဇင်ဝင်းထက်အောင် နမူနာအမည်အပြည့်အစုံ',
  parent_a: 'ဦးအောင်မင်း နမူနာ နှင့်\nဒေါ်ခင်မြ နမူနာ',
  parent_b: 'ဦးဝင်းထက် နမူနာ နှင့်\nဒေါ်နှင်းအေး နမူနာ',
  event_date: '2027-02-14', event_time: '09:30', venue: 'နမူနာဧည့်ခန်းမ\nနမူနာနေရာ ဒုတိယစာကြောင်း',
  message: 'နမူနာဖိတ်ကြားစာ ပထမစာကြောင်း\nနမူနာဖိတ်ကြားစာ ဒုတိယစာကြောင်း',
  photos: [{ id:'synthetic-photo', url:'/test/synthetic-placeholder.png', caption:'Synthetic test image', position:0 }],
};
const formal = (p: Project) => renderToStaticMarkup(<Invitation project={p}/>).match(/<article class="paper invitation-paper"[\s\S]*?<\/article>/)![0];

describe('traditional Myanmar wedding card and vertical full names', () => {
  test('all three designs read parent A → person A → parent B → person B → wording → date and venue details', () => {
    for (const template of ['thazin','noir','rose'] as Design[]) {
      const html = formal({...fixture,template});
      const sequence = [fixture.person_a,fixture.person_b,fixture.message,fixture.venue];
      const text = visibleText(html);
      let prior = -1;
      for (const value of sequence) { const index=text.indexOf(value);expect(index).toBeGreaterThan(prior);prior=index; }
      expect(renderedParentTexts(html)).toEqual([fixture.parent_a, fixture.parent_b]);
      expect(html).toContain('dateTime="2027-02-14"');
      expect(html).not.toContain('09:30');
      expect(html).not.toContain('traditional-time');
      expect(html.split(fixture.person_a).length-1).toBe(1);
      expect(html.split(fixture.person_b).length-1).toBe(1);
      expect(html).toContain('traditional-heading');
      expect(html).not.toContain('class="families"');
      expect(html).not.toContain('class="date-line"');
    }
  });
  test('an absent parent group does not create a blank family column or placeholder', () => {
    const html=formal({...fixture,parent_a:'  ',parent_b:'Only supplied parent family'});
    expect((html.match(/class="traditional-parents"/g)||[]).length).toBe(1);
    expect(renderedParentTexts(html)).toEqual(['Only supplied parent family']);
    expect(html).not.toContain('တို့၏ မိသားစု');
    expect(html).not.toContain('မိဘအမည် မထည့်ရသေးပါ');
  });
  test('event time is never guest-facing; empty optional event fields are omitted and no personal details are invented', () => {
    const html=formal({...fixture,parent_a:'',parent_b:'',event_date:'',event_time:'',venue:''});
    expect(html).not.toContain('class="traditional-parents"');
    expect(html).not.toContain('class="traditional-event"');
    expect(html).not.toContain('B.Sc');
    expect(html).not.toContain('တို့၏ သား');
    expect(html).not.toContain('တို့၏ သမီး');
    expect(html).not.toContain('မသတ်မှတ်ရသေးပါ');
  });
  test('first-page full names are normal-flow blocks outside all three 3D scenes, not text overlays on the photo', () => {
    for(const template of ['thazin','noir','rose'] as Design[]){
      const html=renderToStaticMarkup(<Invitation project={{...fixture,template}}/>);
      const page=html.match(/<article class="paper popup-paper active"[\s\S]*?<\/article>/)![0];
      expect(page).not.toContain('class="scene-names"');
      expect(page).not.toContain('class="popup-names"');
      expect(page).toContain(`<div class="popup-couple-names"><span class="name-pair"><span>${fixture.person_a}</span>`);
      expect(page.indexOf('popup-couple-names')).toBeLessThan(page.indexOf('popup-footer'));
      expect(page.split(fixture.person_a).length-1).toBe(1);
      expect(page.split(fixture.person_b).length-1).toBe(1);
    }
  });
  test('parent text and long invitation wording remain exact escaped text with preserved line breaks', () => {
    const wording='နမူနာစာရှည် '.repeat(160)+'\n<iframe src=bad></iframe>';
    const html=formal({...fixture,parent_a:'<script>PRIVATE</script>\nနမူနာမိဘ',message:wording});
    expect(renderedParentTexts(html)).toContain('<script>PRIVATE</script>\nနမူနာမိဘ');
    expect(html).toContain('&lt;script&gt;PRIVATE&lt;/script&gt;');
    expect(html).toContain('နမူနာစာရှည် '.repeat(160));
    expect(html).toContain('&lt;iframe src=bad&gt;&lt;/iframe&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<iframe src=bad>');
  });
});
