import type { Design } from '../types';

/** Purely decorative paper tooling. No names, monograms, dates or layout height.
 * Lives on each real paper leaf so the same decoration follows the 3D curl. */
export default function PaperFiligree({ design = 'thazin' }: { design?: Design }) {
  return <svg className="paper-filigree" data-design={design} viewBox="0 0 400 560" preserveAspectRatio="none" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1">
    {design === 'noir' ? <>
      <path d="M52 8H348V18H372V42H390V518H372V542H348V552H52V542H28V518H10V42H28V18H52Z"/>
      <path d="M62 14H338V26H364V50H384V510H364V534H338V546H62V534H36V510H16V50H36V26H62Z" opacity=".45"/>
      <path d="M170 8 185 22H215L230 8M170 552 185 538H215L230 552M10 246 24 260V300L10 314M390 246 376 260V300L390 314"/>
      {[0,1,2,3].map(i=><g key={i} transform={`translate(${i % 2 ? 400 : 0} ${i > 1 ? 560 : 0}) scale(${i % 2 ? -1 : 1} ${i > 1 ? -1 : 1})`}>
        <path d="M25 74V34H68M32 88V42H81M40 96V50H93"/>
        <path d="M44 26 52 34 44 42 36 34Z" fill="currentColor" stroke="none"/>
      </g>)}
    </> : <>
      <path d="M58 9H342Q352 9 352 20Q352 42 389 42V518Q352 518 352 540Q352 551 342 551H58Q48 551 48 540Q48 518 11 518V42Q48 42 48 20Q48 9 58 9Z"/>
      <path d="M64 15H336Q346 15 346 26Q346 48 383 48V512Q346 512 346 534Q346 545 336 545H64Q54 545 54 534Q54 512 17 512V48Q54 48 54 26Q54 15 64 15Z" opacity=".35"/>
      {[0,1,2,3].map(i=><g key={i} transform={`translate(${i % 2 ? 400 : 0} ${i > 1 ? 560 : 0}) scale(${i % 2 ? -1 : 1} ${i > 1 ? -1 : 1})`}>
        {design === 'rose' ? <>
          <path d="M20 94Q39 64 51 39M24 72Q51 72 66 50M42 54Q30 43 35 24M58 39Q83 29 91 18"/>
          <path d="M36 30C18 5 65 1 51 27C77 9 90 46 61 45C83 66 47 78 44 51C17 69 9 38 36 30Z" opacity=".5"/>
          <path d="M43 29C28 21 32 49 48 42C67 52 70 28 52 27C48 18 38 21 43 29Z"/>
          <path d="M24 73Q6 61 14 46Q33 54 24 73ZM62 44Q77 33 86 42Q78 57 62 44Z" fill="currentColor" opacity=".13"/>
        </> : <>
          <path d="M19 98Q31 51 79 20M25 68Q6 49 18 26Q42 41 25 68ZM41 45Q33 19 50 15Q65 37 41 45ZM52 34Q73 48 91 32Q75 16 52 34Z"/>
          <path d="M22 88Q56 77 60 56Q45 62 42 73M24 80Q12 71 15 61M63 30Q74 17 83 20" opacity=".7"/>
          <path d="M19 98Q31 51 79 20" strokeWidth="2" opacity=".2"/>
        </>}
      </g>)}
      <path d="M167 10Q185 30 200 12Q215 30 233 10M167 550Q185 530 200 548Q215 530 233 550"/>
      <path d="m200 5 5 6-5 6-5-6Zm0 538 5 6-5 6-5-6Z" fill="currentColor" stroke="none"/>
    </>}
  </svg>;
}
