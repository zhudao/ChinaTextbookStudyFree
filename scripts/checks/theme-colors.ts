import assert from 'node:assert/strict';
import { UI_THEMES } from '../../packages/core/src/cosmetics';
import { themeAccentColors } from '../../apps/web/src/lib/themeColors';
function rgb(value: string): number[] {
  return value.startsWith('#') ? [1,3,5].map(i => Number.parseInt(value.slice(i,i+2),16)) : value.match(/[\d.]+/g)!.map(Number);
}
function luminance(value: string): number {
  return rgb(value).slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
}
function ratio(a: string,b: string): number {const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for (const theme of UI_THEMES) for (const dark of [false,true]) {
  const {primary,primaryDark,accent}=theme.data;
  const colors=themeAccentColors(primary,primaryDark,accent,dark);
  for(const [fill,label,onFill] of [[primary,'--theme-primary-ink','--theme-on-primary'],[accent,'--theme-accent-ink','--theme-on-accent'],[primaryDark,'--theme-primary-ink','--theme-on-primary-dark']]) {
    assert.ok(ratio(fill,colors[onFill])>=4.5,`${theme.id}: filled button ${ratio(fill,colors[onFill])}`);
    for(const surface of dark ? ['#131F24','#202F36','#37464F'] : ['#FFFFFF','#F7F7F7','#E5E5E5']) {
      assert.ok(ratio(colors[label],surface)>=4.5,`${theme.id}: ${label} on ${surface}`);
    }
  }
}
console.log('All 10 equipped themes have readable labels and filled-button foregrounds in both modes.');
