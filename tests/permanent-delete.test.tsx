import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DeleteProjectDialog from '../src/components/DeleteProjectDialog';
import { emptyProject, type Project } from '../src/types';

const project: Project = {
  ...emptyProject,
  id: 'delete-project',
  title: 'A day to remember',
  username: 'remember-us',
  status: 'published',
  photos: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  public_key: 'legacy-long-key',
};

describe('private permanent-delete confirmation', () => {
  test('warns about irreversible deletion and link reuse, and keeps deletion disabled before matching input', () => {
    const html = renderToStaticMarkup(
      <DeleteProjectDialog project={project} lang="en" busy={false} onConfirm={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain('Delete invitation permanently?');
    expect(html).toContain('This cannot be undone.');
    expect(html).toContain('/i/remember-us');
    expect(html).toContain('if reused, the old short link will open the new invitation');
    expect(html).toContain('Old key-bearing links will not open the replacement.');
    expect(html).toContain('placeholder="remember-us"');
    expect(html).toMatch(/class="danger-primary"[^>]*disabled=""/);
  });

  test('renders the destructive action only in the explicit dialog and includes Burmese warnings', () => {
    const html = renderToStaticMarkup(
      <DeleteProjectDialog project={project} lang="my" busy={false} onConfirm={() => {}} onClose={() => {}} />,
    );
    expect(html).toContain('ဖိတ်စာကို အပြီးတိုင်ဖျက်မလား။');
    expect(html).toContain('ပြန်ယူ၍မရပါ။');
    expect(html).toContain('/i/remember-us');
    expect(html).toContain('အတည်ပြုရန် ဤအသုံးပြုသူအမည်ကို ရိုက်ထည့်ပါ');
    expect(html).toContain('အပြီးတိုင်ဖျက်မည်');
  });
});
