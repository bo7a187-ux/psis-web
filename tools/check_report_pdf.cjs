const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file:///home/user/psis-web/dist-single/index.html'); await p.waitForTimeout(400);
  await p.click('text=Try with sample data'); await p.waitForTimeout(1200);
  // draft PDF
  await p.click('.side >> text=Monthly report'); await p.waitForTimeout(600);
  await p.fill('textarea', 'Mechanical works are recovering; MEP resequencing under review.'); await p.waitForTimeout(300);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'report-draft.pdf', format: 'A4', preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: 'screen' });
  // approve then PDF again
  await p.click('.side >> text=Approve & results'); await p.waitForTimeout(300);
  await p.fill('#rev', 'A. Planner'); await p.click('text=Approve this import'); await p.waitForTimeout(300);
  await p.click('.side >> text=Monthly report'); await p.waitForTimeout(500);
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: 'report-approved.pdf', format: 'A4', preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: 'screen' });
  // delay export
  await p.click('.side >> text=Delay analysis'); await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Export to Excel')]);
  await dl.saveAs('delay.xlsx'); console.log('xlsx:', dl.suggestedFilename());
  console.log('errors:', errs.join('\n') || 'none');
  await b.close();
})();
