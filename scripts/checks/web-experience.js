/** Read-only assertions for rendered pages, including immersive and empty states. */
(() => {
  const visible = e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(e).visibility!=="hidden"; };
  const failures=[];
  const metrics={route:location.pathname+location.search,width:innerWidth,height:innerHeight,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
  if(metrics.scrollWidth>metrics.clientWidth) failures.push('Horizontal page overflow');
  if(!Array.from(document.querySelectorAll('main,[role="main"]')).some(visible)) failures.push('Main content missing');
  const headings=Array.from(document.querySelectorAll('h1,h2,[data-shop-name]')).filter(visible);
  metrics.clippedHeadings=headings.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent);
  if(metrics.clippedHeadings.length) failures.push('Clipped heading');
  metrics.failedImages=Array.from(document.images).filter(e=>visible(e)&&e.complete&&e.naturalWidth===0).map(e=>e.getAttribute('src'));
  if(metrics.failedImages.length) failures.push('Broken image');
  const dialogs=Array.from(document.querySelectorAll('[role="dialog"]')).filter(visible);
  if(getComputedStyle(document.body).overflow === "hidden" && document.querySelector('[role="dialog"]') && !dialogs.length) failures.push("Page scroll locked without a visible dialog");
  for(const e of dialogs){
    const label=e.getAttribute('aria-label')||document.getElementById(e.getAttribute('aria-labelledby')||'')?.textContent;
    if(!label) failures.push('Unnamed dialog');
    const r=e.getBoundingClientRect();
    if(r.top<0||r.bottom>innerHeight+1) failures.push('Dialog extends outside viewport');
  }
  metrics.undersizedButtons=Array.from(document.querySelectorAll('button,[role="button"]')).filter(e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true').flatMap(e=>{
    if(e.closest('nextjs-portal')) return [];
    const r=e.getBoundingClientRect();
    const name=e.getAttribute('aria-label')||e.textContent?.trim()||e.getAttribute('title')||'';
    return r.height<43||r.width<43?[{name,width:r.width,height:r.height}]:[];
  });
  metrics.immersiveNav= /^(\/lesson\/|\/jump\/|\/review\/runner\/|\/book\/[^/]+\/guide\/|\/reading\/[^/]+\/[^/]+\/|\/stories\/[^/]+\/[^/]+\/)/.test(location.pathname) && Array.from(document.querySelectorAll('nav')).some(visible);
  if(metrics.immersiveNav) failures.push('Main navigation intrudes into immersive flow');
  return {passed:failures.length===0,failures,metrics};
})()
