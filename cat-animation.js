const noBtn = document.getElementById('noBtn');
const yesBtn = document.getElementById('yesBtn');
const cat = document.getElementById('cat');
const catText = document.getElementById('catText');
const success = document.getElementById('success');
const dateModal = document.getElementById('dateModal');
const dateForm = document.getElementById('dateForm');
const datePicker = document.getElementById('datePicker');
const timePicker = document.getElementById('timePicker');
const sitSprite = document.getElementById('catSit');
const runSprite = document.getElementById('catRun');
const runBack = document.getElementById('runBack');
const runFront = document.getElementById('runFront');
const groomBack = document.getElementById('groomBack');
const groomFront = document.getElementById('groomFront');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let groomReady = false, runReady = false, groomFrame = 0, groomStarted = 0;
// Twelve incremental photographs, with long rests and deliberately slow paw lifts.
const groomingSequence = [
    [0, 2200], [1, 320], [2, 320], [3, 340], [4, 380],
    [5, 260], [6, 260], [7, 300], [8, 280], [7, 300],
    [6, 260], [7, 300], [8, 280], [9, 360], [10, 340],
    [11, 340], [0, 3200]
];
const groomingDuration = groomingSequence.reduce((sum, pose) => sum + pose[1], 0);
// Register each photograph to frame 0's planted tail/haunch and floor line.
// Values are measured in the 362px atlas cells, not viewport coordinates.
const groomingRegistration = [
    [0,0], [19,0], [39,0], [63,0], [11,13], [29,12],
    [48,12], [66,12], [22,8], [32,8], [47,7], [55,7]
];
function showGroomFrame(element, index, register = false) {
    element.style.backgroundPosition = `${(index % 4) * 100/3}% ${Math.floor(index / 4) * 50}%`;
    const [x,y] = register ? groomingRegistration[index] : [0,0];
    element.style.transform = `translate(${x/362*100}%, ${y/362*100}%)`;
}
function showRunFrame(travel) {
    if (!runReady) return;
    // A complete stride covers 0.65 body lengths. Feet slow as the cat brakes.
    const phase = reducedMotion.matches ? 0 : travel / (cat.offsetWidth * .65) * 12;
    const current = Math.floor(phase) % 12, next = (current + 1) % 12;
    showGroomFrame(runBack, current);
    showGroomFrame(runFront, next);
    runFront.style.opacity = phase % 1;
    cat.dataset.runFrame = String(current);
}
function stopGrooming() {
    cancelAnimationFrame(groomFrame);
    groomFrame = 0;
}
function startGrooming() {
    stopGrooming();
    if (!groomReady || state !== 'sitting' || document.hidden) return;
    showGroomFrame(groomBack, 0, true);
    showGroomFrame(groomFront, 0, true);
    groomFront.style.opacity = 1;
    cat.dataset.groomFrame = '0';
    if (reducedMotion.matches) return;
    groomStarted = performance.now();
    function groom(now) {
        if (state !== 'sitting' || document.hidden) return;
        if (reducedMotion.matches) { startGrooming(); return; }
        let elapsed = (now - groomStarted) % groomingDuration;
        let index = 0;
        while (elapsed >= groomingSequence[index][1]) {
            elapsed -= groomingSequence[index][1];
            index++;
        }
        const current = groomingSequence[index][0];
        const previous = groomingSequence[(index + groomingSequence.length - 1) % groomingSequence.length][0];
        showGroomFrame(groomBack, previous, true);
        showGroomFrame(groomFront, current, true);
        // Blend adjacent small pose changes while keeping long rests completely still.
        groomFront.style.opacity = smooth(Math.min(1, elapsed / 200));
        cat.dataset.groomFrame = String(current);
        groomFrame = requestAnimationFrame(groom);
    }
    groomFrame = requestAnimationFrame(groom);
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
const lerp = (a, b, p) => a + (b - a) * p;
const smooth = p => p * p * (3 - 2 * p);
const mouth = {x: 333/362, y: 153/362};
let state = 'sitting', frame = 0, attempts = 0;
let facing = 1, catX = 0, catY = 0;
let pointer = {x: -1000, y: -1000};
let lastTrigger = {x: -1000, y: -1000};
let rearmAt = 0;
const catTriggerDistance = 140;
const slot = document.createElement('span');
const initial = noBtn.getBoundingClientRect();
slot.style.cssText = `width:${initial.width}px;height:${initial.height}px;flex-shrink:0`;
noBtn.replaceWith(slot);
document.body.appendChild(noBtn);
noBtn.style.position = 'fixed';

function placeButton(x, y) {
    noBtn.style.left = `${x}px`;
    noBtn.style.top = `${y}px`;
}
function pose(x, y, direction, running = 0) {
    catX = x; catY = y; facing = direction;
    cat.style.left = `${x}px`;
    cat.style.top = `${y}px`;
    cat.style.setProperty('--facing', direction);
    sitSprite.style.opacity = 1 - running;
    runSprite.style.opacity = running;
}
function setState(next) {
    if (state !== next) stopGrooming();
    state = next;
    cat.dataset.state = next;
    if (next === 'sitting') startGrooming();
}
function restingAt(x, y) {
    const s = cat.offsetWidth, w = noBtn.offsetWidth, h = noBtn.offsetHeight;
    const direction = x >= s * .85 + 8 ? 1 : -1;
    return {x: clamp(direction === 1 ? x - s * .83 : x + w - s * .17, 4, innerWidth-s-4),
        y: clamp(y + h - s * .91, 8, innerHeight-s-8), direction};
}
function sitBesideButton() {
    const r = noBtn.getBoundingClientRect();
    const p = restingAt(r.left, r.top);
    pose(p.x, p.y, p.direction);
    setState('sitting');
}
// The button hangs from its top centre, exactly at the sprite's lips.
function mouthPose(gripX, gripY, direction) {
    const s = cat.offsetWidth;
    return {x: gripX - (direction === 1 ? mouth.x : 1-mouth.x)*s, y: gripY-mouth.y*s};
}
function carry(gripX, gripY, direction, swing = 0) {
    const p = mouthPose(gripX, gripY, direction);
    pose(p.x, p.y, direction, 1);
    placeButton(gripX - noBtn.offsetWidth/2, gripY - 3);
    noBtn.style.transform = `rotate(${swing}deg)`;
}
function chooseDestination(start) {
    const s=cat.offsetWidth, w=noBtn.offsetWidth, h=noBtn.offsetHeight;
    const yes=yesBtn.getBoundingClientRect();
    const minY=Math.min(s*.8+20,innerHeight-h-20);
    const maxY=Math.max(minY,innerHeight-s*(1-mouth.y)-22);
    let best;
    for(let i=0;i<160;i++) {
        const x=12+Math.random()*Math.max(0,innerWidth-w-24);
        const y=minY+Math.random()*Math.max(0,maxY-minY);
        const direction=x>=start.left?1:-1;
        const p=mouthPose(x+w/2,y+3,direction);
        if(p.x<4 || p.x+s>innerWidth-4) continue;
        const rest=restingAt(x,y);
        // The destination cat and button both leave Yes unobstructed.
        if(x<yes.right+20 && x+w>yes.left-20 && y<yes.bottom+20 && y+h>yes.top-20) continue;
        if(rest.x<yes.right && rest.x+s>yes.left && rest.y<yes.bottom && rest.y+s>yes.top) continue;
        const distance=Math.hypot(x-start.left,y-start.top);
        const away=Math.hypot(x+w/2-pointer.x,y+h/2-pointer.y);
        const score=distance+away*.35;
        if(!best || score>best.score) best={x,y,direction,score};
    }
    return best || {x:clamp(start.left<innerWidth/2?innerWidth-w-16:16,12,innerWidth-w-12),
        y:clamp(start.top,minY,maxY),direction:start.left<innerWidth/2?1:-1};
}
function biteAndRun(event) {
    event?.preventDefault();
    if(state!=='sitting' || success.classList.contains('show')) return;
    attempts++;
    lastTrigger={...pointer};
    setState('approaching');
    catText.classList.remove('is-visible');
    showRunFrame(0);
    catText.textContent = attempts===1 ? 'Mine!' : 'Not this time!';
    const start=noBtn.getBoundingClientRect();
    const next=chooseDestination(start);
    const origin={x:catX,y:catY};
    const direction=next.direction;
    const grip={x:start.left+start.width/2,y:start.top+3};
    const pickup=mouthPose(grip.x,grip.y,direction);
    const rest=restingAt(next.x,next.y);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const travelDistance=Math.hypot(next.x-start.left,next.y-start.top);
    const approach=reduced?100:620, bite=reduced?60:240, lift=reduced?100:380;
    const run=reduced?220:clamp(travelDistance/220*1000,1600,3600);
    const lower=reduced?100:520, settle=reduced?100:600;
    const tBite=approach, tLift=tBite+bite, tRun=tLift+lift, tLower=tRun+run, tSit=tLower+lower, end=tSit+settle;
    const height=reduced?10:Math.min(45,cat.offsetWidth*.23);
    let began;
    function animate(now) {
        began ??= now;
        const t=now-began;
        if(t<tBite) {
            const p=smooth(clamp(t/approach,0,1));
            pose(lerp(origin.x,pickup.x,p),lerp(origin.y,pickup.y,p),direction,p);
        } else if(t<tLift) {
            setState('biting');
            // Pause at contact before lifting, so the bite is visible.
            carry(grip.x,grip.y,direction);
            noBtn.classList.add('in-mouth');
        } else if(t<tRun) {
            setState('lifting');
            const p=smooth((t-tLift)/lift);
            carry(grip.x,grip.y-height*p,direction, reduced?0:direction*4*p);
        } else if(t<tLower) {
            setState('running');
            const p=(t-tRun)/run, ease=smooth(p);
            const traveled=travelDistance*ease;
            showRunFrame(traveled);
            const gait=reduced?0:Math.sin(traveled/(cat.offsetWidth*.65)*Math.PI*2);
            const bounce=reduced?0:-Math.abs(gait)*2*Math.sin(p*Math.PI);
            carry(lerp(grip.x,next.x+start.width/2,ease),
                lerp(grip.y,next.y+3,ease)-height+bounce,direction,reduced?0:gait*5);
        } else if(t<tSit) {
            setState('lowering');
            const p=smooth((t-tLower)/lower);
            carry(next.x+start.width/2,next.y+3-height*(1-p),direction);
        } else if(t<end) {
            setState('sitting-down');
            noBtn.classList.remove('in-mouth');
            noBtn.style.transform='';
            placeButton(next.x,next.y);
            const p=smooth((t-tSit)/settle);
            const released=mouthPose(next.x+start.width/2,next.y+3,direction);
            pose(lerp(released.x,rest.x,p),lerp(released.y,rest.y,p),rest.direction,1-p);
        } else {
            noBtn.classList.remove('in-mouth');
            noBtn.style.transform='';
            placeButton(next.x,next.y);
            sitBesideButton();
            catText.textContent='Naeem loves you so much, say YES!';
            catText.classList.add('is-visible');
            rearmAt=performance.now()+250;
            return;
        }
        frame=requestAnimationFrame(animate);
    }
    frame=requestAnimationFrame(animate);
}
document.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse') return;
    pointer={x:event.clientX,y:event.clientY};
    if(state!=='sitting' || performance.now()<rearmAt) return;
    const r=noBtn.getBoundingClientRect();
    const distance=Math.hypot(pointer.x-clamp(pointer.x,r.left,r.right),pointer.y-clamp(pointer.y,r.top,r.bottom));
    if(distance<catTriggerDistance && Math.hypot(pointer.x-lastTrigger.x,pointer.y-lastTrigger.y)>8) biteAndRun();
});
noBtn.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse' && performance.now()>=rearmAt) biteAndRun();});
noBtn.addEventListener('pointerdown',biteAndRun);
noBtn.addEventListener('click',biteAndRun);
function resetLayout() {
    cancelAnimationFrame(frame);
    noBtn.classList.remove('in-mouth');
    noBtn.style.transform='';
    const r=attempts?noBtn.getBoundingClientRect():slot.getBoundingClientRect();
    placeButton(clamp(r.left,12,innerWidth-r.width-12),clamp(r.top,12,innerHeight-r.height-12));
    sitBesideButton();
}
window.addEventListener('resize',resetLayout);
placeButton(initial.left,initial.top);
sitBesideButton();
const groomingImage = new Image();
groomingImage.onload = async () => {
    try { await groomingImage.decode(); } catch (_) { return; }
    groomReady = true;
    cat.dataset.groomReady = 'true';
    startGrooming();
};
groomingImage.src = 'assets/cat-grooming-12.png';
const runningImage = new Image();
runningImage.onload = async () => {
    try { await runningImage.decode(); } catch (_) { return; }
    runReady = true;
    cat.dataset.runReady = 'true';
    showRunFrame(0);
};
runningImage.src = 'assets/cat-running-12.png';
document.addEventListener('visibilitychange', () => document.hidden ? stopGrooming() : startGrooming());
reducedMotion.addEventListener('change', startGrooming);
const today = new Date();
datePicker.min = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

function showSuccess() {
    dateModal.classList.remove('show');
    success.classList.add('show');
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for(let i=0;i<40;i++) {
        const heart=document.createElement('div');
        heart.className='boom-heart';heart.textContent=i%2?'\u2764\ufe0f':'\ud83d\udc95';
        heart.style.cssText=`left:50vw;top:50vh;font-size:${17+Math.random()*30}px;--x:${(Math.random()-.5)*1000}px;--y:${(Math.random()-.5)*800}px;--r:${Math.random()*720}deg`;
        document.body.appendChild(heart);setTimeout(()=>heart.remove(),1600);
    }
}

yesBtn.addEventListener('click',()=>{
    cancelAnimationFrame(frame);
    setState('finished');
    dateModal.classList.add('show');
    datePicker.focus();
});
dateForm.addEventListener('submit', event=>{
    event.preventDefault();
    if(!dateForm.reportValidity()) return;
    showSuccess();
});
