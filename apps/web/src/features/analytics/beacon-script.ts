/**
 * The cookie-free counter of a creator page (ADR 0081), as the few lines of
 * script that app/u/[username]/layout.tsx writes into the page, and only while the server switch is
 * on. Inline on purpose: no module in any bundle, so with the switch off a creator page carries not one
 * byte of counting code (a client component would have shared a chunk with the page's other islands).
 *
 * It sends, to the page's own origin (/api/collect, `fetch` with `keepalive` and no credentials: never
 * `navigator.sendBeacon`, which always sends the site's cookies, a signed-in owner's session included),
 * one view once the page is really seen (not while prerendered or in a background tab) and one tap for
 * each link or button inside a block (`data-block`, the renderer's block marks; a double tap within a
 * second is one). A view carries the referring site's host name only, never
 * its address; a step inside the page (from the page or one of its project pages, the same host and
 * the page's own first path segment) is marked `s:"page"` and adds no source, and `?src=qr` marks a QR
 * code. It reads and writes nothing on the visitor's device (no cookie, no storage, no fingerprint),
 * and a browser that sends Global Privacy Control or Do Not Track sends nothing at all. beacon.test.ts
 * runs it against a fake browser and holds its text to these rules.
 */
const SOURCE = `(function(page){
var nav=navigator,doc=document;
if(nav.globalPrivacyControl===true||nav.doNotTrack==="1")return;
function send(event){
event.p=page;
try{fetch("/api/collect",{method:"POST",body:JSON.stringify(event),keepalive:true,credentials:"omit"}).catch(function(){})}catch(e){}
}
var seen=false;
function view(){
if(seen||doc.visibilityState!=="visible"||doc.prerendering)return;
seen=true;
var from="",step=false;
try{if(doc.referrer){var before=new URL(doc.referrer);from=before.hostname;step=before.host===location.host&&before.pathname.split(/\\//)[1]===page}}catch(e){}
var event={t:"v",r:from};
if(step)event.s="page";
try{if(new URLSearchParams(location.search).get("src")==="qr")event.s="qr"}catch(e){}
send(event);
}
var last="",lastAt=0;
function tap(event){
if(event.type==="auxclick"&&event.button!==1)return;
var target=event.target,control=target&&target.closest?target.closest("a[href],button,[role=button]"):null;
var holder=control&&control.closest("[data-block]"),block=holder&&holder.getAttribute("data-block");
if(!block)return;
var now=Date.now();
if(block===last&&now-lastAt<1000)return;
last=block;lastAt=now;
send({t:"c",b:block});
}
doc.addEventListener("visibilitychange",view);
doc.addEventListener("prerenderingchange",view);
doc.addEventListener("click",tap,true);
doc.addEventListener("auxclick",tap,true);
view();
})`;

/** The script for one page: its name goes in as a JSON string, with "<" escaped so it cannot end the tag. */
export function beaconScript(page: string): string {
  return `${SOURCE}(${JSON.stringify(page).replace(/</g, "\\u003c")});`;
}
