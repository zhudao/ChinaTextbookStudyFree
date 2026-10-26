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
  for (const action of ['primary','accent']) {
    assert.deepEqual(rgb(colors[`--action-${action}-bg`]), rgb(action === 'primary' ? primary : accent), `${theme.id}: artwork fills must retain the exact palette`);
    assert.ok(ratio(colors[`--action-${action}-bg`], colors[`--action-${action}-ink`]) >= 4.5, `${theme.id}: ${dark ? 'dark' : 'light'} action foreground`);
    assert.ok(luminance(colors[`--action-${action}-edge`]) < luminance(colors[`--action-${action}-bg`]), `${theme.id}: action depth must be darker`);
  }
  for(const [fill,label,onFill] of [[primary,'--theme-primary-ink','--theme-on-primary'],[accent,'--theme-accent-ink','--theme-on-accent'],[primaryDark,'--theme-primary-ink','--theme-on-primary-dark']]) {
    assert.ok(ratio(fill,colors[onFill])>=4.5,`${theme.id}: filled button ${ratio(fill,colors[onFill])}`);
    for(const surface of dark ? ['#131F24','#202F36','#37464F'] : ['#FFFFFF','#F7F7F7','#E5E5E5']) {
      assert.ok(ratio(colors[label],surface)>=4.5,`${theme.id}: ${label} on ${surface}`);
    }
  }
}
const brand = themeAccentColors('#58CC02', '#58A700', '#1CB0F6', false);
assert.equal(brand['--action-primary-bg'], '#58CC02');
assert.equal(brand['--action-primary-edge'], '#58A700');
assert.equal(brand['--action-accent-bg'], '#1CB0F6');
assert.equal(brand['--action-accent-edge'], '#1899D6');
console.log('PASS: exact brand fills and edges; action labels and small text meet 4.5:1 across all 10 themes and both modes.');
