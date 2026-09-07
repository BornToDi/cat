const {chromium}=require('playwright');
const {pathToFileURL}=require('url');
const path=require('path');
const assert=require('assert');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const size of [{width:1440,height:900},{width:390,height:844},{width:320,height:640}]){
  const page=await browser.newPage({viewport:size});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('micee.html')).href);
  await page.waitForTimeout(200);
  await page.waitForFunction(()=>groomReady && runReady);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now()+100));
  const width=await page.locator('#cat').evaluate(el=>el.offsetWidth);
  assert(width<=150,'cat is smaller');
  const groomingFrames=new Set();
  await page.evaluate(()=>startGrooming());
  for(let i=0;i<60;i++) {
    await page.clock.runFor(200);
    groomingFrames.add(await page.locator('#cat').getAttribute('data-groom-frame'));
  }
  assert(groomingFrames.size===12,'all twelve grooming poses play');
  await page.evaluate(()=>startGrooming());
  await page.clock.runFor(4200);
  await page.screenshot({path:`.browser-check/grooming-${size.width}.png`});
  await page.screenshot({path:`.browser-check/sitting-${size.width}.png`});
  const before=await page.locator('#noBtn').boundingBox();
  await page.mouse.move(before.x-20,before.y+10);
  assert.equal(await page.evaluate(()=>state),'approaching','cursor proximity starts pickup');
  assert.equal(await page.evaluate(()=>groomFrame),0,'grooming stops for pickup');
  await page.clock.runFor(350);
  const still=await page.locator('#noBtn').boundingBox();
  assert(Math.abs(still.x-before.x)<.5 && Math.abs(still.y-before.y)<.5,'button waits for bite');
  const seen=new Set();
  const runningFrames=new Set();
  for(let i=0;i<80;i++) {
    await page.clock.runFor(100);
    const sample=await page.evaluate(()=>({state,dx:parseFloat(noBtn.style.left)+noBtn.offsetWidth/2-(catX+(facing===1?mouth.x:1-mouth.x)*cat.offsetWidth),dy:parseFloat(noBtn.style.top)+3-(catY+mouth.y*cat.offsetWidth)}));
    seen.add(sample.state);
    if(sample.state==='running') runningFrames.add(await page.locator('#cat').getAttribute('data-run-frame'));
    if(['biting','lifting','running','lowering'].includes(sample.state)) {
      assert(Math.abs(sample.dx)<.01 && Math.abs(sample.dy)<.01,'button stays attached to mouth');
    }
    if(sample.state==='running' && !seen.has('captured')) {
      await page.screenshot({path:`.browser-check/carrying-${size.width}.png`});seen.add('captured');
    }
  }
  for(const phase of ['biting','lifting','running','lowering','sitting-down','sitting']) assert(seen.has(phase),phase);
  assert(runningFrames.size>=8,'multiple running poses advance with travel');
  for(let i=0;i<4;i++) {
    const r=await page.locator('#noBtn').boundingBox();
    assert(r.x>=11 && r.x+r.width<=size.width-11 && r.y>=11 && r.y+r.height<=size.height-11,'drop on screen');
    await page.locator('#noBtn').dispatchEvent('pointerdown',{pointerType:'touch'});
    await page.clock.runFor(7000);
    assert.equal(await page.evaluate(()=>state),'sitting');
  }
  await page.locator('#noBtn').dispatchEvent('click');
  await page.clock.runFor(900);
  await page.setViewportSize({width:size.width,height:size.height-40});
  await page.waitForTimeout(150);
  await page.clock.runFor(100);
  assert.equal(await page.evaluate(()=>state),'sitting','resize cancels carry cleanly');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.runFor(100);
  assert.equal(await page.evaluate(()=>groomFrame),0,'reduced motion stops grooming');
  await page.locator('#noBtn').dispatchEvent('click');
  await page.clock.runFor(1000);
  assert.equal(await page.evaluate(()=>state),'sitting');
  await page.locator('#noBtn').dispatchEvent('click');
  await page.locator('#yesBtn').dispatchEvent('click');
  await page.clock.runFor(4500);
  assert.equal(await page.evaluate(()=>state),'finished');
  assert(await page.locator('#success').evaluate(e=>e.classList.contains('show')));
  assert.deepEqual(errors,[]);
  await page.close();
 }
 await browser.close();console.log('Passed: 12 grooming poses, running poses, three viewport sizes, proximity/touch/repeat, bite/lift/run/drop/sit, mouth attachment, resize, reduced motion, and Yes interruption.');
})().catch(e=>{console.error(e);process.exit(1)});
