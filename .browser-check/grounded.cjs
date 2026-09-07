const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
const path=require('path');
const assert=require('assert');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  const page=await browser.newPage({viewport});
  await page.goto(pathToFileURL(path.resolve('micee.html')).href);
  await page.waitForFunction(()=>groomReady && runReady);
  await page.evaluate(()=>stopGrooming());
  const box=await page.locator('#cat').boundingBox();
  const clip={x:Math.ceil(box.x),y:Math.ceil(box.y+box.height*.8),width:Math.floor(box.width),height:Math.floor(box.height*.19)};
  let baseline;
  for(let i=0;i<12;i++) {
   await page.evaluate(i=>{showGroomFrame(groomBack,i,true);showGroomFrame(groomFront,i,true);groomFront.style.opacity=1;},i);
   const pixels=await page.screenshot({clip});
   if(!baseline) baseline=pixels;
   else if(!pixels.equals(baseline)) {
    fs.writeFileSync('.browser-check/feet-before.png',baseline);
    fs.writeFileSync('.browser-check/feet-after.png',pixels);
    assert.fail(`feet/tail pixels must stay identical in frame ${i}`);
   }
   assert.deepEqual(await page.locator('#cat').boundingBox(),box);
   if(i===6) await page.screenshot({path:`.browser-check/grounded-${viewport.width}.png`});
  }
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
  await page.locator('#noBtn').dispatchEvent('click');
  assert.equal(await page.evaluate(()=>state),'approaching');
  await page.clock.runFor(7500);
  assert.equal(await page.evaluate(()=>state),'sitting');
  await page.close();
 }
 await browser.close();console.log('Passed: identical grounded pixels across all 12 poses at desktop/mobile sizes; pickup and return still work.');
})().catch(e=>{console.error(e);process.exit(1)});
