import type { InvitationTemplateId } from './templates/registry';

export type Language = 'my' | 'en';
export type Design = InvitationTemplateId;
export type Theme = 'sage' | 'midnight' | 'rose' | 'blue';
export interface Photo { id: string; url: string; path?: string; caption: string; position: number }
export interface ScheduleMilestone { time: string; label: string }
export interface ProjectInput { schedule?: ScheduleMilestone[]; title: string; customer_name: string; customer_email: string; customer_phone: string; private_notes: string; person_a: string; person_b: string; parent_a: string; parent_b: string; event_date: string; event_time: string; venue: string; message: string; map_url: string; username: string; template: Design; theme: Theme; project_type: string }
export interface Project extends ProjectInput { id: string; status: 'draft' | 'published'; photos: Photo[]; created_at: string; updated_at: string; public_key: string | null }
export interface ProjectType { id: string; name: string; name_my: string; description: string; enabled: boolean; renderer: string | null }
export interface StudioRepository { list(): Promise<Project[]>; get(id: string): Promise<Project>; save(input: ProjectInput, id?: string): Promise<Project>; upload(id: string, files: File[]): Promise<Project>; removePhoto(id: string, photoId: string): Promise<Project>; publish(id: string): Promise<Project>; revoke(id: string): Promise<Project>; publicProject(username: string, key: string): Promise<Project>; usernameAvailable(username: string, exceptId?: string): Promise<boolean> }
export const projectTypes: ProjectType[] = [{id:'wedding',name:'Wedding invitation',name_my:'မင်္ဂလာဖိတ်စာ',description:'Three immersive designs · Four colour palettes',enabled:true,renderer:'keepsake-book'},{id:'celebration',name:'Celebrations',name_my:'အထိမ်းအမှတ်ပွဲများ',description:'Birthdays, milestones & beautiful moments',enabled:false,renderer:null},{id:'business',name:'Business projects',name_my:'လုပ်ငန်းဆိုင်ရာ ပရောဂျက်များ',description:'Thoughtful experiences for your business',enabled:false,renderer:null}];
export const emptyProject: ProjectInput = { title:'',customer_name:'',customer_email:'',customer_phone:'',private_notes:'',person_a:'',person_b:'',parent_a:'',parent_b:'',event_date:'',event_time:'',venue:'',message:'မင်္ဂလာဧည့်ခံပွဲသို့ ကြွရောက်၍ မင်္ဂလာဆုမွန်ကောင်းများ ချီးမြှင့်ပေးပါရန် မေတ္တာဖြင့် ဖိတ်ကြားအပ်ပါသည်။',map_url:'',username:'',template:'thazin',theme:'sage',project_type:'wedding' };
