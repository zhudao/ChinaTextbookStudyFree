/** Read-only browser audit. Run through the browser tool after hydration and
 * entrance animations settle, at 320/390/768/1280px. No storage or clock edits. */
(() => {
  const visible = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0 && r.height>0 && s.visibility!=='hidden'; };
  const failures=[];
  const controls=[...document.querySelectorAll('button,summary,[role="button"]')].filter(visible).filter(e=>!e.getAttribute('aria-label')?.includes('Next.js'));
  const short=controls.filter(e=>e.getBoundingClientRect().height<43.5).map(e=>({label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,30),height:e.getBoundingClientRect().height}));
  if(document.documentElement.scrollWidth>innerWidth+1)failures.push('page has horizontal overflow');
  if(short.length)failures.push('controls smaller than 44px');
  const scroll=document.querySelector('.lesson-content');
  if(scroll && scroll.scrollWidth>scroll.clientWidth+1)failures.push('lesson has horizontal overflow');
  const action=document.querySelector('.lesson-actions');
  if(action && action.getBoundingClientRect().bottom>innerHeight+1)failures.push('check action is below the viewport');
  const options=[...document.querySelectorAll('.option-card')].filter(visible);
  const prompt=document.querySelector('.question-prompt');
  const widths=options.map(e=>e.getBoundingClientRect().width);
  const lesson=location.pathname.includes('/lesson/')||location.pathname.includes('/review/runner/');
  if(lesson && widths.length>1 && options[0].parentElement.parentElement===options[widths.length-1].parentElement.parentElement && Math.max(...widths)-Math.min(...widths)>1)failures.push('choice rows have inconsistent widths');
  const metrics={route:location.pathname,viewport:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,controls:controls.length,shortControls:short,promptTop:prompt?.getBoundingClientRect().top??null,actionTop:action?.getBoundingClientRect().top??null,optionWidths:widths,font:getComputedStyle(document.body).fontFamily,dark:document.documentElement.classList.contains('theme-dark')};
  return {passed:failures.length===0,failures,metrics};
})()
