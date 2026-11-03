import {describe,expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import Invitation from '../src/components/Invitation';
import {emptyProject,type Design,type Project} from '../src/types';
import {venueMap} from '../src/components/invitationData';
import {renderedParentTexts} from './helpers/markup-text';
const project:Project={...emptyProject,id:'one-screen-test',created_at:'',updated_at:'',status:'draft',public_key:null,photos:[],person_a:'မောင်ပြည့်ဖြိုးအောင်',person_b:'မနှင်းသဇင်ဝင်း',parent_a:'Supplied parent A',parent_b:'Supplied parent B',event_date:'2027-02-14',event_time:'09:30',venue:'Supplied Hall\nSupplied location'};
const formal=(p:Project)=>renderToStaticMarkup(<Invitation project={p}/>).match(/<article class="paper invitation-paper"[\s\S]*?<\/article>/)![0];
describe('one-screen event card and supplied maps only',()=>{
 test('each printed card contains both full names and exact supplied venue/date while keeping time hidden',()=>{
  for(const template of ['thazin','noir','rose'] as Design[]){const html=formal({...project,template});for(const value of [project.person_a,project.person_b,project.event_date,project.venue])expect(html).toContain(value);expect(renderedParentTexts(html)).toEqual([project.parent_a,project.parent_b]);expect(html).toContain('traditional-location');expect(html).not.toContain(project.event_time);expect(html).not.toContain('traditional-time');}
 });
 test('venue alone never creates a map, iframe, map arrow, or map action',()=>{
  expect(venueMap('Supplied Hall','')).toEqual({embed:'',href:'',directions:''});
  const html=renderToStaticMarkup(<Invitation project={project}/>);
  expect(html).toContain(project.venue);expect(html).not.toContain('data-map-src');expect(html).not.toContain('traditional-map-link');expect(html).not.toContain('journey-map-button');expect(html).not.toContain('id="venue-jump"');
 });
 test('short map links remain exact supplied links and never invent embeds from venue text',()=>{
  const url='https://maps.app.goo.gl/supplied-map-example';const map=venueMap('Different supplied venue',url);
  expect(map).toEqual({embed:'',href:url,directions:url});
  for(const template of ['thazin','noir','rose'] as Design[]){const html=formal({...project,template,map_url:url});expect(html).toContain(`href="${url}"`);expect(html).toContain('traditional-map-link');expect(html).not.toContain('maps/search');}
 });
 test('untrusted/empty URLs cannot enable map actions and provided coordinates are not guessed',()=>{
  for(const url of ['','javascript:alert(1)','https://evil.example/maps','https://google.com/other','https://goo.gl/other','https://user:password@google.com/maps'])expect(venueMap('Entered venue',url).href).toBe('');
  const actual='https://www.google.com/maps?q=16.8,96.15';expect(venueMap('Venue',actual).href).toBe(actual);expect(venueMap('Venue',actual).embed).toContain('16.8%2C96.15');
 });
});
