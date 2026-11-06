import { describe, expect, test } from 'bun:test';
import { getInvitationTemplate, INVITATION_TEMPLATES } from '../src/templates/registry';

describe('invitation template registry', () => {
  test('lists the current stable template IDs in display order', () => {
    expect(INVITATION_TEMPLATES.map(({ id }) => id)).toEqual(['thazin', 'noir', 'rose']);
  });

  test('provides the metadata needed by editor, showcase, preview, and invitation renderer', () => {
    for (const template of INVITATION_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.descriptionEn.length).toBeGreaterThan(0);
      expect(template.descriptionMy.length).toBeGreaterThan(0);
      expect(template.preview.src).toMatch(/^\/assets\/showcase-preview\//);
      expect(template.preview.enAlt.length).toBeGreaterThan(0);
      expect(template.preview.myAlt.length).toBeGreaterThan(0);
      expect(template.arrival.heading.length).toBeGreaterThan(0);
    }
  });

  test('uses the configured default colour and falls back to the current default for unknown IDs', () => {
    expect(INVITATION_TEMPLATES.map(({ defaultTheme }) => defaultTheme)).toEqual(['sage', 'midnight', 'rose']);
    expect(getInvitationTemplate('unknown').id).toBe('thazin');
  });
});
