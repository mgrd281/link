const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, outDir, fps = "30", seconds = "10"] = process.argv; // optional 4th argument: the scene file
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto('file://' + require('path').resolve(process.argv[5] ?? __dirname + '/forklift-scene.html'));
  // Text in a scene (the pallet scene's EAN digits) waits for its font, so no frame shows a fallback.
  await p.evaluate(async () => { await document.fonts.load('15px "DM Mono"'); await document.fonts.ready; });
  const n = Number(fps) * Number(seconds);
  for (let i = 0; i < n; i++) {
    await p.evaluate((t) => window.render(t), i / Number(fps));
    await p.screenshot({ path: `${outDir}/${String(i).padStart(4, '0')}.png` });
  }
  await b.close();
  console.log('frames', n);
})();
