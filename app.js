// RULE FOR ANY DEV/AI EDITING THIS FILE: do not add explanatory comments, hint text, or verbose descriptions beyond what's functionally necessary. Keep additions minimal — don't pad character/line count.
/* =========================================================================
   CRYPTENA — USER APP
   Firebase Realtime Database powered. No mock data, no Cloud Functions.
   ========================================================================= */

(function lockLongPress(){
  const editable = t => {
    const el = t && t.nodeType === 3 ? t.parentElement : t;
    return !!(el && el.closest && el.closest('input,textarea,[contenteditable="true"]'));
  };
  document.addEventListener('contextmenu', e => { if(!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener('selectstart', e => { if(!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener('dragstart', e => e.preventDefault(), true);
})();

/* ---------------- FIREBASE INIT ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyD2ztNAlJSWqDp10T8JIOcxvFrxWMl2jRQ",
  authDomain: "tap-foxio.firebaseapp.com",
  databaseURL: "https://tap-foxio-default-rtdb.firebaseio.com",
  projectId: "tap-foxio",
  storageBucket: "tap-foxio.firebasestorage.app",
  messagingSenderId: "699504694778",
  appId: "1:699504694778:web:e2987e4843f10cd57f4043",
  measurementId: "G-CYH50CY3ZZ"
};
firebase.initializeApp(firebaseConfig);
const realDb = firebase.database();
let db = realDb;   // guest mode e eta local (in-memory) db diye replace hobe
const SERVER_INC = (n) => firebase.database.ServerValue.increment(n);

/* ---------------- TELEGRAM MINI APP SETUP ---------------- */
const tg = window.Telegram && window.Telegram.WebApp;
(function initTelegram(){
  try{
    if(tg){
      tg.ready();
      tg.expand();
      if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      try{ tg.setHeaderColor('#F4F6FB'); }catch(e){}
      try{ tg.setBackgroundColor('#F4F6FB'); }catch(e){}
      const applyViewportHeight = ()=>{
        const h = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
        document.documentElement.style.setProperty('--tg-vh', h + 'px');
      };
      const applySafeArea = ()=>{
        const sa = tg.safeAreaInset || {}, ca = tg.contentSafeAreaInset || {};
        const top = (Number(sa.top)||0) + (Number(ca.top)||0);
        const bottom = (Number(sa.bottom)||0) + (Number(ca.bottom)||0);
        const root = document.documentElement.style;
        root.setProperty('--safe-top', top > 0 ? top + 'px' : 'env(safe-area-inset-top, 0px)');
        root.setProperty('--safe-bottom', bottom > 0 ? bottom + 'px' : 'env(safe-area-inset-bottom, 0px)');
      };
      applySafeArea();
      ['safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'].forEach(ev=>{ if(tg.onEvent) tg.onEvent(ev, applySafeArea); });
      applyViewportHeight();
      tg.onEvent && tg.onEvent('viewportChanged', applyViewportHeight);
      window.addEventListener('resize', applyViewportHeight);
    } else {
      document.documentElement.style.setProperty('--tg-vh', window.innerHeight + 'px');
      window.addEventListener('resize', ()=>{
        document.documentElement.style.setProperty('--tg-vh', window.innerHeight + 'px');
      });
    }
  }catch(e){
    document.documentElement.style.setProperty('--tg-vh', '100vh');
  }
})();

/* ---------------- NAV ---------------- */
// Full-screen pages (no bottom nav, own header + back button)
const SUB_PAGES = ['deposit','withdraw','notifications'];
let currentPage = 'home';
const pageStack = [];

function showPage(name, keepScroll){
  const el = document.getElementById('page-'+name);
  if(!el) return;
  document.querySelectorAll('.page, .fs-page').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  const isSub = SUB_PAGES.indexOf(name) !== -1;
  document.body.classList.toggle('sub-open', isSub);
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.nav===name));
  currentPage = name;
  if(!isSub && !keepScroll) window.scrollTo(0,0);
  syncTgBackButton();
}
function goTo(name){
  if(SUB_PAGES.indexOf(name) !== -1){
    if(currentPage !== name) pageStack.push(currentPage);
  } else {
    pageStack.length = 0;
  }
  showPage(name);
}
function goBack(){
  const prev = pageStack.pop() || 'home';
  showPage(prev, true);
}
function syncTgBackButton(){
  try{
    if(!(tg && tg.initData && tg.BackButton)) return;
    if(SUB_PAGES.indexOf(currentPage) !== -1) tg.BackButton.show(); else tg.BackButton.hide();
  }catch(e){}
}
try{ if(tg && tg.initData && tg.BackButton) tg.BackButton.onClick(goBack); }catch(e){}

/* ---------------- HTML ESCAPE ---------------- */
function esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
/* Round logo/icon box: shows a fallback letter until the image (direct link) loads */
function logoBox(url, fallback, cls){
  const img = url ? `<img src="${esc(url)}" alt="" onload="this.previousElementSibling.style.display='none'" onerror="this.remove()">` : '';
  return `<div class="${cls}"><span>${esc(fallback)}</span>${img}</div>`;
}

/* ---------------- WALLET HELPERS ---------------- */
// masked view: first 4 + ****** + last 6  (e.g. ckdi******rjdiej). Full address is never shown to the user.
function maskAddr(a){
  a = String(a || '');
  if(a.length > 12) return a.slice(0,4) + '******' + a.slice(-6);
  if(a.length > 4)  return a.slice(0,2) + '******' + a.slice(-2);
  return a ? '******' : '';
}
function hasWallet(u){
  const w = (u || me) && (u || me).wallets;
  return !!w && Object.keys(w).some(k => w[k]);
}
// gate for daily claim / mining: a connected wallet is required
function requireWallet(what){
  if(hasWallet()) return true;
  showToast('Connect a wallet first to ' + what);
  openWallet();
  return false;
}

/* ---------------- TELEGRAM AVATAR ---------------- */
function avatarInner(photoUrl, letter){
  const img = photoUrl ? `<img src="${esc(photoUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  return `<span>${esc(letter)}</span>${img}`;
}
function tgUserInfo(){
  return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
}
// top bar: Telegram profile picture + Telegram name (falls back to the saved user record)
function renderBrand(){
  const t = tgUserInfo();
  const src = t || me;
  if(!src) return;
  const first = t ? t.first_name : src.firstName;
  const last  = t ? t.last_name  : src.lastName;
  const uname = t ? t.username   : src.username;
  const name  = ((first||'') + (last ? ' '+last : '')).trim() || uname || 'Cryptena';
  const badgeHtml = me ? badgeIconInlineHtml(me) : '';
  const photo = (t && t.photo_url) || (me && me.photoUrl) || '';
  const av = document.getElementById('brand-avatar');
  const nm = document.getElementById('brand-name');
  if(nm) nm.innerHTML = esc(name) + badgeHtml;
  if(av){
    const key = photo + '|' + name.charAt(0);
    if(av.dataset.key !== key){
      av.dataset.key = key;
      av.innerHTML = avatarInner(photo, name.charAt(0).toUpperCase());
    }
  }
}

/* ---------------- TOAST ---------------- */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ---------------- GLOBAL CACHES ---------------- */
// 30-day cycle, rising from 0.42 to 1.58 CRTA (+0.04/day) — claiming all 30 days pays exactly 30 CRTA → reward balance
const DAILY_REWARDS = Array.from({length:30}, (_,i)=>Math.round((0.42+i*0.04)*100)/100);
const fmtReward = n => Number(n).toFixed(2);
let me = null;              // live snapshot of users/{uid}
let uid = null;
let settings = {
  swapRate:0.85,
  supportUrl:'https://t.me/Cryptena_Support', telegramChannelUrl:'https://t.me/Cryptena_Official', botUsername:'cryptenaBot', appShortName:'',
  activeAdNetwork:'monetag', monetagZoneId:'', adsgramBlockId:'', botToken:''
};
let depositMethods = {};
let withdrawMethods = {};
let badgesCache = {};
let minersCache = {};
let tasksCache = {};
let notifCache = {};
let leaderboardCache = [];
let miningTickInterval = null;
let currentTxTab = 'all';
let currentTaskTab = 'all';
let userSocialCache = {};
let socialTaskId = null, socialImage = null, socialBusy = false;
let modalMode = 'deposit';
let selectedMethodId = null;

/* ---------------- REFERRAL CODE GEN ----------------
   Format (8 chars): 2 letters from name + 4 chars from UID + 1 random A-Z + 1 random 0-9 */
function genReferralCode(nameSeed, idSeed){
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const nameClean = (nameSeed || 'U').trim().toUpperCase().replace(/[^A-Z]/g,'');
  const namePart = (nameClean || 'U').padEnd(2,'X').slice(0,2);
  const idClean = String(idSeed).replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  const idPart = idClean.slice(-4).padStart(4,'X');
  const randLetter = letters.charAt(Math.floor(Math.random()*letters.length));
  const randDigit = digits.charAt(Math.floor(Math.random()*digits.length));
  return namePart + idPart + randLetter + randDigit;
}
async function generateUniqueReferralCode(nameSeed, idSeed){
  for(let i=0;i<8;i++){
    const code = genReferralCode(nameSeed, idSeed);
    const snap = await db.ref('referralIndex/'+code).get();
    if(!snap.exists()) return code;
  }
  // extremely unlikely fallback: still 8 chars, seeded with time to force a new random tail
  return genReferralCode(nameSeed, idSeed + Date.now());
}

/* =========================================================================
   GUEST MODE (browser testing)
   Telegram er baire (normal browser e) khulle app guest hisebe chalbe.
   - Shared data (settings, tasks, badges, methods, leaderboard, notifications)
     real Firebase theke READ hoy.
   - Guest user er sob data + sob WRITE shudhu browser memory te thake.
     Firebase e kono write jay na. Page refresh dile guest data reset hoy.
   Production e guest mode bondho korte: ALLOW_GUEST_MODE = false
   ========================================================================= */
const ALLOW_GUEST_MODE = true;
const GUEST_OVERRIDES = {          // test er subidhar jonno guest er starting value
  crpt: 200,                       // earning balance (CRTA) — mining / tasks / daily reward
  depositBalance: 500,             // deposit balance — only from deposits, swaps to CRTA (badge %)
  usdBalance: 100                  // USD — withdrawable
};
let IS_GUEST = false;

function createGuestDb(realDb, guestUid){
  const store = {};
  const listeners = [];
  let flushQueued = false;

  const parts = p => String(p || '').split('/').filter(Boolean);
  const clone = v => (v === undefined || v === null) ? null : JSON.parse(JSON.stringify(v));
  const isSV = v => v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, '.sv');
  const isLocalPath = p => p === 'users/' + guestUid || p.indexOf('users/' + guestUid + '/') === 0;

  function getAt(path){
    let n = store;
    for(const k of parts(path)){
      if(n === null || typeof n !== 'object' || !(k in n)) return null;
      n = n[k];
    }
    return n === undefined ? null : n;
  }

  // ServerValue.TIMESTAMP / increment() local-e resolve kora
  function resolveValue(val, old){
    if(val === null || val === undefined) return null;
    if(isSV(val)){
      const sv = val['.sv'];
      if(sv === 'timestamp') return Date.now();
      if(sv && typeof sv === 'object' && 'increment' in sv) return (typeof old === 'number' ? old : 0) + Number(sv.increment);
      return null;
    }
    if(typeof val === 'object'){
      const out = {};
      Object.keys(val).forEach(k=>{
        const r = resolveValue(val[k], (old && typeof old === 'object') ? old[k] : undefined);
        if(r !== null) out[k] = r;
      });
      return Object.keys(out).length ? out : null;
    }
    return val;
  }

  function setAt(path, val){
    const keys = parts(path);
    if(!keys.length){
      Object.keys(store).forEach(k=> delete store[k]);
      const r = resolveValue(val, null);
      if(r && typeof r === 'object') Object.assign(store, r);
      return;
    }
    let n = store;
    for(let i = 0; i < keys.length - 1; i++){
      if(n[keys[i]] === null || typeof n[keys[i]] !== 'object') n[keys[i]] = {};
      n = n[keys[i]];
    }
    const last = keys[keys.length - 1];
    const r = resolveValue(val, n[last]);
    if(r === null) delete n[last]; else n[last] = r;
  }

  function makeSnap(path){
    const val = clone(getAt(path));
    const key = parts(path).pop() || null;
    const snap = {
      key,
      exists: () => val !== null,
      val: () => clone(val),
      forEach: cb => {
        if(val && typeof val === 'object'){
          for(const k of Object.keys(val)){
            const child = { key: k, exists: () => true, val: () => clone(val[k]) };
            if(cb(child) === true) break;
          }
        }
        return false;
      }
    };
    return snap;
  }

  function queueFlush(){
    if(flushQueued) return;
    flushQueued = true;
    Promise.resolve().then(()=>{
      flushQueued = false;
      listeners.slice().forEach(l=>{
        const cur = JSON.stringify(getAt(l.path));
        if(cur !== l.last){ l.last = cur; l.cb(makeSnap(l.path)); }
      });
    });
  }

  function write(path, val){ setAt(path, val); queueFlush(); return Promise.resolve(); }
  function updateAt(path, obj){
    Object.keys(obj || {}).forEach(k=> setAt(parts(path).concat(parts(k)).join('/'), obj[k]));
    queueFlush();
    return Promise.resolve();
  }

  function makeRef(rawPath){
    const path = parts(rawPath).join('/');
    const local = isLocalPath(path);
    const real = () => path ? realDb.ref(path) : realDb.ref();
    const ref = {
      key: parts(path).pop() || null,
      get: () => local ? Promise.resolve(makeSnap(path)) : real().get(),
      on: (ev, cb) => {
        if(!local) return real().on(ev, cb);          // shared data: real Firebase (read-only)
        const l = { path, cb, last: null };
        listeners.push(l);
        Promise.resolve().then(()=>{ l.last = JSON.stringify(getAt(path)); cb(makeSnap(path)); });
        return cb;
      },
      off: (ev, cb) => {
        if(!local) return real().off(ev, cb);
        for(let i = listeners.length - 1; i >= 0; i--) if(listeners[i].path === path && (!cb || listeners[i].cb === cb)) listeners.splice(i, 1);
      },
      // ---- WRITE: shob local memory te, Firebase e kokhono na ----
      set: v => write(path, v),
      update: obj => updateAt(path, obj),
      remove: () => write(path, null),
      push: v => {
        const key = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const child = makeRef(path + '/' + key);
        if(v === undefined) return child;
        const p = child.set(v);
        child.then = p.then.bind(p);
        child.catch = p.catch.bind(p);
        return child;
      },
      transaction: (fn, cb) => {
        const cur = clone(getAt(path));
        const out = fn(cur);
        const committed = out !== undefined;
        if(committed) write(path, out);
        if(cb) cb(null, committed, makeSnap(path));
        return Promise.resolve({committed});
      },
      orderByChild: c => real().orderByChild(c)       // leaderboard query: real read
    };
    return ref;
  }

  return { ref: makeRef };
}

function showGuestBadge(){
  const bar = document.querySelector('.top-actions');
  if(!bar || document.getElementById('guest-pill')) return;
  const pill = document.createElement('div');
  pill.id = 'guest-pill';
  pill.className = 'guest-pill';
  pill.textContent = 'GUEST · not saved';
  pill.onclick = ()=> showToast('Guest mode: data database e save hobe na');
  bar.prepend(pill);
}

/* ---------------- BOOT ---------------- */
async function boot(){
  // loading screen is visible only while data loads; show a hint if the network is slow
  setTimeout(()=>{
    const ls = document.getElementById('loading-screen');
    if(ls && ls.style.display !== 'none'){ const h = document.getElementById('loading-slow'); if(h) h.classList.add('show'); }
  }, 8000);
  let tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  let startParam = '';
  if(!tgUser || !tgUser.id){
    if(!ALLOW_GUEST_MODE){
      document.getElementById('loading-screen').innerHTML =
        '<div style="font-size:34px;">📱</div><div style="color:var(--dim);font-size:13px;font-weight:600;max-width:260px;text-align:center;">Please open Cryptena from inside Telegram to continue.</div>';
      return;
    }
    // ---- GUEST MODE: Telegram chhara browser e open ----
    IS_GUEST = true;
    const guestId = 'guest_' + Math.random().toString(36).slice(2, 8);
    tgUser = { id: guestId, username: 'guest', first_name: 'Guest', last_name: 'User' };
    db = createGuestDb(realDb, guestId);
    showGuestBadge();
  } else {
    startParam = (tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
  }
  uid = String(tgUser.id);
  renderBrand();

  const userRef = db.ref('users/'+uid);
  const snap = await userRef.get();

  if(!snap.exists()){
    const nameSeed = tgUser.username || tgUser.first_name || 'U';
    const code = await generateUniqueReferralCode(nameSeed, uid);

    let referredByUid = null;
    const refCode = String(startParam||'').trim().replace(/^ref_/i,'').toUpperCase();
    if(refCode){
      try{
        const idxSnap = await db.ref('referralIndex/'+refCode).get();
        if(idxSnap.exists() && idxSnap.val() !== uid) referredByUid = idxSnap.val();
      }catch(e){}
    }
    if(!referredByUid && !IS_GUEST){
      try{
        const pend = await db.ref('pendingReferrals/'+uid).get();
        const pr = pend.exists() ? pend.val() : null;
        if(pr && pr.referrerUid && String(pr.referrerUid) !== uid){
          const chk = await db.ref('users/'+pr.referrerUid+'/referralCode').get();
          if(chk.exists()) referredByUid = String(pr.referrerUid);
        }
      }catch(e){}
    }

    const newUser = {
      uid, telegramId: uid,
      username: tgUser.username || '',
      firstName: tgUser.first_name || '',
      lastName: tgUser.last_name || '',
      photoUrl: tgUser.photo_url || '',
      // ---- 3 separate balances ----
      crpt: 0,                // 1) earning balance (CRTA) — mining, tasks, daily reward. Swaps to USD at the admin rate.
      depositBalance: 0,      // 2) deposit balance — ONLY from accepted deposits. Swaps to CRTA (kept % = badge "Deposit swap %"). Never withdrawable.
      usdBalance: 0,          // 3) USD — the withdrawable balance (CRTA->USD swaps + referral commission)
      referralCode: code,
      referredBy: referredByUid,
      referralsNormal: 0,
      referralsActive: 0,
      referEarned: 0,
      wallets: {},
      badge: DEFAULT_BADGE_ID,
      status: 'active',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      streakDay: 1,
      streak: 0,
      claimedToday: false,
      lastClaimDate: '',
      miner: {id:'', active:false, startedAt:0, cooldownUntil:0},
      ownedMiners: {},
      totalMining: 0, totalTask: 0, totalWithdraw: 0, totalDeposit: 0,
      todayDeposit: 0, todayDepositDate: '', todayReferrals: 0, todayReferralsDate: '',
      minedToday: 0, minedTodayDate: ''
    };
    if(IS_GUEST) Object.assign(newUser, GUEST_OVERRIDES);
    await userRef.set(newUser);
    await db.ref('referralIndex/'+code).set(uid);

    // Referral counts only if the referrer has a connected wallet.
    if(referredByUid){
      try{
        const wSnap = await db.ref('users/'+referredByUid+'/wallets').get();
        if(!hasWallet({wallets: wSnap.val() || {}})) referredByUid = null;
      }catch(e){ referredByUid = null; }
      if(!referredByUid) await userRef.update({referredBy: null});
    }
    if(referredByUid){
      // No CRTA is paid out just for a new referral joining. Referral
      // earnings only happen as a % commission when this referred user
      // withdraws — that's handled on the admin side at withdraw approval.
      const refUpdates = {};
      refUpdates['users/'+referredByUid+'/referralsNormal'] = SERVER_INC(1);
      refUpdates['users/'+referredByUid+'/referrals/'+uid] = {
        name: (tgUser.first_name||tgUser.username||'New user'),
        username: tgUser.username || '',
        photoUrl: tgUser.photo_url || '',
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'normal'
      };
      await db.ref().update(refUpdates);
      notifyNewReferral(referredByUid, tgUser);
    }
    if(!IS_GUEST) db.ref('pendingReferrals/'+uid).remove().catch(()=>{});
  } else {
    const sync = {lastSeen: firebase.database.ServerValue.TIMESTAMP};
    if(!IS_GUEST){
      if(tgUser.first_name != null) sync.firstName = tgUser.first_name || '';
      if(tgUser.last_name != null || snap.val().lastName) sync.lastName = tgUser.last_name || '';
      sync.username = tgUser.username || '';
      if(tgUser.photo_url) sync.photoUrl = tgUser.photo_url;
    }
    userRef.update(sync);
    // existing account that never joined through a referrer: apply a link it clicked in the bot
    applyLateReferral();
  }

  // realtime listeners
  db.ref('settings/general').on('value', s=>{
    const prevNet = settings.activeAdNetwork, prevM = settings.monetagZoneId, prevA = settings.adsgramBlockId;
    if(s.exists()) Object.assign(settings, s.val());
    if(!String(settings.botUsername||'').trim()) settings.botUsername = 'cryptenaBot';
    if(!String(settings.supportUrl||'').trim()) settings.supportUrl = 'https://t.me/Cryptena_Support';
    if(!String(settings.telegramChannelUrl||'').trim()) settings.telegramChannelUrl = 'https://t.me/Cryptena_Official';
    if(!settings.activeAdNetwork) settings.activeAdNetwork = 'monetag';
    if(prevNet!==settings.activeAdNetwork || prevM!==settings.monetagZoneId || prevA!==settings.adsgramBlockId){
      resetAdSdkCache();
    }
    refreshSwapUI();
    if(me) renderHome();      // live "≈ USD" estimate follows the admin's swap rate
  });
  db.ref('depositMethods').on('value', s=>{ depositMethods = s.val()||{}; renderDepositMethods(); });
  db.ref('withdrawMethods').on('value', s=>{ withdrawMethods = s.val()||{}; renderWithdrawPage(); });
  db.ref('badges').on('value', s=>{
    badgesCache = s.val()||{};
    renderBadges();
    if(me){ renderBrand(); renderProfile(); renderLeaderboard(); }
  });
  db.ref('tasks').on('value', s=>{ tasksCache = s.val()||{}; renderTasks(); });
  db.ref('userSocial/'+uid).on('value', s=>{ userSocialCache = s.val()||{}; renderTasks(); });
  // bot saved a referral click while the app is already open -> apply it right away (only if still un-referred)
  if(!IS_GUEST) db.ref('pendingReferrals/'+uid).on('value', s=>{ if(s.exists() && me && !me.referredBy) applyLateReferral(); });
  db.ref('miners').on('value', s=>{ minersCache = s.val()||{}; renderMinersList(); if(me) renderMiningStatic(); });
  db.ref('users').orderByChild('totalMining').limitToLast(50).on('value', s=>{
    const arr = [];
    s.forEach(c=>{ arr.push(Object.assign({uid:c.key}, c.val())); });
    arr.reverse();
    leaderboardCache = arr;
    renderLeaderboard();
    renderHomeRank();
  });

  userRef.on('value', s=>{
    if(!s.exists()) return;
    me = Object.assign({uid}, s.val());
    if(me.status === 'banned'){
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('banned-screen').style.display = 'flex';
      return;
    }
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('banned-screen').style.display = 'none';
    checkDailyReset();
    resumeMining();
    renderAll();
  });

  listenNotifications();
}

function dayStr(offset){ return new Date(Date.now()+offset*86400000).toISOString().slice(0,10); }
function checkDailyReset(){
  const today = dayStr(0), yesterday = dayStr(-1);
  const updates = {};
  const last = me.lastClaimDate || '';
  const day = me.streakDay || 1;
  if(me.streak === undefined){
    updates.streak = Math.max(0, day-1);
    if(last && last !== today && me.claimedToday) updates.claimedToday = false;
  } else if(last && last !== today){
    if(last === yesterday){
      if(me.claimedToday){ updates.claimedToday = false; updates.streakDay = day < DAILY_REWARDS.length ? day+1 : 1; }
    } else if(me.claimedToday || me.streak || day !== 1){
      updates.claimedToday = false; updates.streakDay = 1; updates.streak = 0;
    }
  }
  if(me.minedTodayDate !== today){ updates.minedToday = 0; updates.minedTodayDate = today; }
  if(me.todayDepositDate !== today){ updates.todayDeposit = 0; updates.todayDepositDate = today; }
  if(me.todayReferralsDate !== today){ updates.todayReferrals = 0; updates.todayReferralsDate = today; }
  if(Object.keys(updates).length){ db.ref('users/'+uid).update(updates); }
}
setInterval(()=>{ if(me && uid) checkDailyReset(); }, 60000);

function renderAll(){
  renderBrand();
  renderHome();
  renderRefer();
  renderProfile();
  renderBadges();
  renderTransactions();
  renderMiningStatic();
  refreshSwapUI();
  renderSwapHistory();
  renderWithdrawPage();
  renderWalletMethodList();
}

/* ---------------- TRANSACTIONS LOG HELPER ---------------- */
function pushTxLocal(forUid, type, title, amt){
  if(!forUid) return;
  db.ref('users/'+forUid+'/txlog').push({
    type, title, amt: (amt>=0?'+':'')+Number(amt).toFixed(4)+' CRTA', time: firebase.database.ServerValue.TIMESTAMP
  });
}
function pushTx(type, title, amt, unit){
  db.ref('users/'+uid+'/txlog').push({
    type, title, amt: (amt>=0?'+':'')+Number(amt).toFixed(4)+' '+(unit||'CRTA'), time: firebase.database.ServerValue.TIMESTAMP
  });
}

/* =========================================================================
   AD NETWORK SYSTEM (Monetag / Adsgram)
   Exactly one network is active at a time (admin picks it in Settings).
   Every "gated" button needs the user to watch one rewarded ad before the
   real action runs. While locked the button shows a lock icon + "Watch 1 ad
   to unlock" INSTEAD of its normal icon + name. 1st click = show the ad;
   ad watched = the button flips back to its own icon + name (unlocked);
   2nd click = the real action runs and the button re-locks for next time.
   If the ad fails/is skipped, nothing happens — no unlock, no action.
   (Deposit / Withdraw shortcuts, Level and Transactions are NOT gated.)
   ========================================================================= */
let adsgramController = null, adsgramLoadedBlockId = null;
let monetagLoadedZoneId = null, monetagScriptEl = null;

// Wipe cached SDK state — called whenever admin changes the active network or its id,
// so the next ad request always uses the freshest zone/block id.
function resetAdSdkCache(){
  adsgramController = null; adsgramLoadedBlockId = null;
  monetagLoadedZoneId = null;
}

function ensureAdsgramLoaded(blockId){
  return new Promise((resolve, reject)=>{
    if(window.Adsgram && adsgramController && adsgramLoadedBlockId===blockId){ resolve(adsgramController); return; }
    function init(){
      try{
        adsgramController = window.Adsgram.init({ blockId });
        adsgramLoadedBlockId = blockId;
        resolve(adsgramController);
      }catch(e){ reject(e); }
    }
    if(window.Adsgram){ init(); return; }
    let script = document.getElementById('adsgram-sdk-tag');
    if(!script){
      script = document.createElement('script');
      script.id = 'adsgram-sdk-tag';
      script.src = 'https://sad.adsgram.ai/js/sad.min.js';
      document.head.appendChild(script);
    }
    script.addEventListener('load', init, {once:true});
    script.addEventListener('error', ()=>reject(new Error('adsgram-sdk-failed')), {once:true});
    if(window.Adsgram) init();
  });
}

function ensureMonetagLoaded(zoneId){
  const fnName = 'show_' + zoneId;
  return new Promise((resolve, reject)=>{
    if(monetagLoadedZoneId===zoneId && typeof window[fnName]==='function'){ resolve(fnName); return; }
    if(monetagScriptEl) monetagScriptEl.remove();
    monetagScriptEl = document.createElement('script');
    monetagScriptEl.id = 'monetag-sdk-tag';
    monetagScriptEl.src = '//libtl.com/sdk.js';
    monetagScriptEl.setAttribute('data-zone', zoneId);
    monetagScriptEl.setAttribute('data-sdk', fnName);
    monetagScriptEl.onerror = () => reject(new Error('monetag-sdk-failed'));
    monetagScriptEl.onload = () => {
      let tries = 0;
      (function check(){
        if(typeof window[fnName]==='function'){ monetagLoadedZoneId = zoneId; resolve(fnName); }
        else if(tries++ < 50){ setTimeout(check, 100); }
        else reject(new Error('monetag-sdk-not-ready'));
      })();
    };
    document.head.appendChild(monetagScriptEl);
  });
}

// Shows one rewarded ad using whichever network admin currently has active.
// Resolves when the user watched it through; rejects on any failure/skip/misconfiguration.
function showActiveRewardedAd(){
  const net = settings.activeAdNetwork==='adsgram' ? 'adsgram' : 'monetag';
  if(net==='adsgram'){
    const blockId = (settings.adsgramBlockId||'').trim();
    if(!blockId) return Promise.reject(new Error('ad-not-configured'));
    return ensureAdsgramLoaded(blockId).then(ctrl => ctrl.show());
  }
  const zoneId = (settings.monetagZoneId||'').trim();
  if(!zoneId) return Promise.reject(new Error('ad-not-configured'));
  return ensureMonetagLoaded(zoneId).then(fnName => window[fnName]());
}

// key -> true once the user has watched an ad for that specific button and hasn't used it yet
const adGateUnlocked = {};
// key -> the real action to run once unlocked. Filled in near the bottom of this file,
// once every action/navigation function below has been declared.
const AD_GATE_ACTIONS = {};

function adGateEls(key){
  return document.querySelectorAll('[data-ad-gate="'+key+'"]');
}
function renderAdGate(key){
  const unlocked = !!adGateUnlocked[key];
  adGateEls(key).forEach(el=>{
    el.classList.toggle('ad-locked', !unlocked);
    el.classList.remove('ad-loading');
  });
}
// injects the "lock icon + Watch 1 ad to unlock" view next to the button's own icon + label (.ag-main)
function buildAdGateLock(el){
  if(el.querySelector(':scope > .ag-lock')) return;
  const lock = document.createElement('span');
  lock.className = 'ag-lock';
  lock.innerHTML = lockSvg + '<span>Watch 1 ad to unlock</span>';
  el.insertBefore(lock, el.firstChild);
}
function initAdGates(){
  document.querySelectorAll('[data-ad-gate]').forEach(buildAdGateLock);
  Object.keys(AD_GATE_ACTIONS).forEach(key=>{ adGateUnlocked[key] = false; renderAdGate(key); });
}
// change a gated button's visible name without touching its icon / lock view
function setBtnLabel(target, text){
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if(!el) return;
  const l = el.querySelector('.ag-label');
  (l || el).textContent = text;
}
function adGateClick(key){
  const action = AD_GATE_ACTIONS[key];
  if(!action) return;
  if(adGateUnlocked[key]){
    // already unlocked by a previously watched ad — consume it and run the real action
    adGateUnlocked[key] = false;
    renderAdGate(key);
    action();
    return;
  }
  adGateEls(key).forEach(el=>el.classList.add('ad-loading'));
  showActiveRewardedAd().then(()=>{
    adGateUnlocked[key] = true;
    renderAdGate(key);
    showToast('Ad watched — tap again to continue');
  }).catch(err=>{
    adGateEls(key).forEach(el=>el.classList.remove('ad-loading'));
    if(err && err.message==='ad-not-configured'){
      showToast('Ads are not set up yet — please try again later');
    } else {
      showToast('Ad was not completed — try again');
    }
  });
}

/* ---------------- HOME BALANCE ----------------
   Big number = total balance (CRTA earning balance + deposit balance), animated.
   Small line = live USD value of CRTA-only, if swapped now (CRTA x admin's swap rate). */
let lastRenderedBalance = null;
function swapRate(){ return Number(settings.swapRate) || 0; }
function paintHomeBalance(totalVal){
  const balEl = document.getElementById('home-balance');
  const usdEl = document.getElementById('home-balance-usd');
  balEl.innerHTML = totalVal.toFixed(4) + ' <span class="unit">CRTA</span>';
  const crptOnly = me.crpt || 0;
  usdEl.innerHTML = '≈ $' + (crptOnly * swapRate()).toFixed(4) + ' USD';
}
function firstWalletAddr(){
  const w = me && me.wallets;
  if(!w) return '';
  const id = Object.keys(w).find(k => w[k]);
  return id ? w[id] : '';
}
function renderHome(){
  const addr = firstWalletAddr();
  document.getElementById('bc-wallet').textContent = addr ? maskAddr(addr) : 'Connect wallet';
  const newBal = (me.crpt || 0) + (me.depositBalance || 0);
  if(lastRenderedBalance===null || Math.abs(newBal-lastRenderedBalance) <= 0.0001){
    paintHomeBalance(newBal);
  } else {
    const from = lastRenderedBalance;
    const dur = 550; const start = performance.now();
    function tick(now){
      const p = Math.min((now-start)/dur,1);
      const eased = 1-Math.pow(1-p,3);
      paintHomeBalance(from + (newBal-from)*eased);
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  lastRenderedBalance = newBal;
  document.getElementById('home-mined').textContent = '+' + (me.minedToday||0).toFixed(2);
  document.getElementById('home-today-refer').textContent = me.todayReferrals||0;
  document.getElementById('home-streak').textContent = me.streak||0;
  renderStreak();
  renderHomeRank();
}
function renderHomeRank(){
  if(!me) return;
  const idx = leaderboardCache.findIndex(u=>u.uid===me.uid);
  document.getElementById('home-rank').textContent = idx>=0 ? '#'+(idx+1) : '—';
}

// Shows a sliding 7-day window instead of all 30 at once (looks cluttered otherwise).
// The window always starts at the current claimable day, e.g. Day1 -> [1..6] + pinned Day30,
// after claiming Day1 -> [2..7] + pinned Day30, ... so the user can always see the full
// 30-day cycle length. Once close enough to the end it stops sliding and just shows the
// final 7 days, [24..30], since Day 30 is already naturally inside that window.
function renderStreak(animateIdx){
  const grid = document.getElementById('streak-grid');
  const rewards = DAILY_REWARDS;
  grid.innerHTML = '';
  const total = DAILY_REWARDS.length;
  const windowSize = 7;
  const currentDay = me.streakDay || 1;
  const remaining = total - currentDay + 1;   // days left from today through Day 30
  let days;
  if(remaining <= windowSize){
    const start = Math.max(1, total - windowSize + 1);
    days = []; for(let i=start;i<=total;i++) days.push(i);
  } else {
    days = []; for(let i=currentDay;i<currentDay+windowSize-1;i++) days.push(i);
    days.push(total);   // pin Day 30 as the 7th tile so the 30-day length is always visible
  }
  days.forEach((i, idx)=>{
    const done = i < me.streakDay || (i===me.streakDay && me.claimedToday);
    const today = i === me.streakDay && !me.claimedToday;
    const pinned = idx>0 && (i - days[idx-1]) > 1;   // there's a gap right before this tile
    const div = document.createElement('div');
    div.className = 'day-cell' + (done?' done':'') + (today?' today':'') + (i===total?' final-day':'') + (pinned?' pinned-final':'');
    if(animateIdx===i) div.classList.add('claim-pop');
    div.innerHTML = (done? '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>':'') +
      '<div class="lbl">Day '+i+'</div><div class="amt">'+fmtReward(rewards[i-1])+'</div>';
    grid.appendChild(div);
  });
  const btn = document.getElementById('claim-btn');
  // no wallet yet = no ad needed, the button just sends the user to connect one (so no lock view)
  btn.classList.toggle('ad-bypass', !me.claimedToday && !hasWallet());
  if(me.claimedToday){
    btn.disabled = true;
    setBtnLabel(btn, "Today's reward claimed ✓");
  } else if(!hasWallet()){
    btn.disabled = false;
    setBtnLabel(btn, 'Connect wallet to claim');
  } else {
    btn.disabled = false;
    setBtnLabel(btn, 'Claim +'+fmtReward(rewards[(me.streakDay||1)-1])+' CRTA');
  }
}

function claimDaily(){
  if(!me || me.claimedToday) return;
  if(!requireWallet('claim your daily reward')) return;
  const day = me.streakDay || 1;
  const reward = DAILY_REWARDS[day-1];
  db.ref('users/'+uid).update({
    crpt: SERVER_INC(reward),         // reward balance
    claimedToday: true,
    lastClaimDate: dayStr(0),
    streak: (me.streak||0)+1
  }).then(()=>{
    pushTx('task', 'Daily check-in reward (Day '+day+')', reward, 'CRTA');
    showToast('+'+fmtReward(reward)+' CRTA claimed! 🎉');
    renderStreak(day);
  });
}

/* ---------------- LEADERBOARD ---------------- */
function initials(u){
  const n = u.firstName || u.username || 'U';
  return n.charAt(0).toUpperCase();
}
function displayName(u){
  return (u.firstName || '') + (u.lastName ? ' '+u.lastName : '') || u.username || 'User';
}
function renderLeaderboard(){
  const box = document.getElementById('home-leaderboard');
  if(!box) return;
  if(!leaderboardCache.length){ box.innerHTML = '<div class="empty-state">No miners yet — be the first!</div>'; return; }
  const top3 = leaderboardCache.slice(0,3);
  const rest = leaderboardCache.slice(3,15);
  const podiumHtml = `<div class="podium">
    ${top3.map((u,i)=>{
      const rank=i+1;
      return `<div class="podium-slot rank${rank}">
        ${rank===1?'<div class="crown">👑</div>':''}
        <div class="podium-avatar">${avatarInner(u.photoUrl, initials(u))}</div>
        <div class="podium-name">${nameWithBadgeHtml(u)}</div>
        <div class="podium-sub">${esc(badgeLabel(u))}</div>
        <div class="podium-amt">${(u.totalMining||0).toFixed(2)}</div>
        <div class="podium-base">#${rank}</div>
      </div>`;
    }).join('')}
  </div>`;
  const restHtml = `<div class="lb-rest">${rest.map((u,i)=>`
    <div class="lb-row">
      <div class="lb-rank">#${i+4}</div>
      <div class="lb-avatar">${avatarInner(u.photoUrl, initials(u))}</div>
      <div class="lb-info"><div class="lb-name">${nameWithBadgeHtml(u)}</div><div class="lb-sub">${esc(badgeLabel(u))}</div></div>
      <div class="lb-amt">${(u.totalMining||0).toFixed(2)}</div>
    </div>`).join('')}</div>`;
  box.innerHTML = podiumHtml + restHtml;
}

/* ---------------- PROFILE ---------------- */
function renderProfile(){
  document.getElementById('pf-avatar').innerHTML = avatarInner((tgUserInfo() && tgUserInfo().photo_url) || me.photoUrl || '', initials(me));
  document.getElementById('pf-name').innerHTML = nameWithBadgeHtml(me);
  document.getElementById('pf-username').textContent = me.username ? '@'+me.username : '';
  document.getElementById('pf-uid').textContent = 'UID: '+me.uid;
  document.getElementById('pf-crpt').textContent = (me.crpt||0).toFixed(2);
  document.getElementById('pf-deposit').textContent = (me.depositBalance||0).toFixed(2);
  document.getElementById('pf-usd').textContent = '$'+(me.usdBalance||0).toFixed(2);
  document.getElementById('pf-total-refer').textContent = me.referralsNormal||0;
  document.getElementById('pf-active-refer').textContent = me.referralsActive||0;
  document.getElementById('pf-total-withdraw').textContent = (me.totalWithdraw||0).toFixed(2);
  document.getElementById('pf-total-task').textContent = me.totalTask||0;
  document.getElementById('pf-total-mining').textContent = (me.totalMining||0).toFixed(2);
  document.getElementById('pf-total-deposit').textContent = (me.totalDeposit||0).toFixed(2);
  const walletCount = Object.keys((me.wallets)||{}).length;
  document.getElementById('wallet-val').textContent = walletCount ? (walletCount+' connected') : 'Not linked';
}

/* ---------------- WALLET CONNECT (per withdraw method) ---------------- */
// All enabled withdraw methods, regardless of whether a wallet is connected yet.
// Used on the "Connect wallet" picker page.
function allEnabledWithdrawMethods(){
  return Object.entries(withdrawMethods).filter(([id,m])=> m && m.enabled !== false);
}

function renderWalletMethodList(){
  const list = document.getElementById('wallet-method-list');
  if(!list || !me) return;
  const wallets = me.wallets || {};
  const entries = allEnabledWithdrawMethods();
  list.innerHTML = entries.length ? entries.map(([id,m])=>{
    const connected = !!wallets[id];
    return `
    <div class="method-card${connected?' selected wallet-locked':''}" data-id="${esc(id)}" onclick="openWalletAddress(this.dataset.id)">
      ${logoBox(m.logoUrl, (m.name||'?').trim().charAt(0).toUpperCase(), 'mc-logo')}
      <div class="mc-info">
        <div class="mc-name">${esc(m.name||'Method')}</div>
        ${connected ? `<div class="mc-addr">${esc(maskAddr(wallets[id]))}</div>` : ''}
      </div>
      <div class="mc-side">
        <span class="fee-tag">${connected ? '✓ Connected' : 'Connect'}</span>
        ${connected ? `<span class="lock-ic">${lockSvg}</span>` : ''}
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No withdraw methods available right now</div>';
}

function openWallet(){
  const limit = myMaxWalletConnect();
  if(limit>0 && me && Object.keys(me.wallets||{}).length >= limit){
    showToast('Your level allows connecting up to '+limit+' wallet'+(limit==1?'':'s')+' only');
    return;
  }
  renderWalletMethodList();
  const title = document.getElementById('wallet-sheet-title');
  const back = document.getElementById('wallet-sheet-back');
  const note = document.getElementById('wallet-method-note');
  const label = document.getElementById('wallet-method-label');
  const list = document.getElementById('wallet-method-list');
  const addrBlock = document.getElementById('wallet-address-block');
  const footer = document.getElementById('wallet-sheet-footer');
  title.textContent = 'Connect wallet';
  back.style.display = 'none';
  note.style.display = ''; label.style.display = ''; list.style.display = '';
  addrBlock.style.display = 'none'; footer.style.display = 'none';
  selectedWalletMethodId = null;
  document.getElementById('sheet-wallet').classList.add('active');
}
function closeWalletSheet(){
  document.getElementById('sheet-wallet').classList.remove('active');
  selectedWalletMethodId = null;
}

let selectedWalletMethodId = null;
function openWalletAddress(id){
  const m = withdrawMethods[id];
  if(!m) return;
  if(me && me.wallets && me.wallets[id]){ showToast('Wallet is locked. It cannot be edited or removed.'); return; }
  const limit = myMaxWalletConnect();
  if(limit>0 && me && Object.keys(me.wallets||{}).length >= limit){
    showToast('Your level allows connecting up to '+limit+' wallet'+(limit==1?'':'s')+' only');
    return;
  }
  selectedWalletMethodId = id;
  document.getElementById('wallet-sheet-title').textContent = 'Confirm your ' + (m.name||'wallet') + ' wallet connection';
  document.getElementById('wallet-sheet-back').style.display = '';
  document.getElementById('wallet-method-note').style.display = 'none';
  document.getElementById('wallet-method-label').style.display = 'none';
  document.getElementById('wallet-method-list').style.display = 'none';
  document.getElementById('wallet-address-block').style.display = '';
  document.getElementById('wallet-sheet-footer').style.display = '';
  document.getElementById('wallet-address-input').value = '';
}
function walletSheetBack(){
  openWallet();
}

function saveWalletAddress(){
  const id = selectedWalletMethodId;
  const m = id ? withdrawMethods[id] : null;
  if(!m){ showToast('Select a method first'); openWallet(); return; }
  const val = document.getElementById('wallet-address-input').value.trim();
  if(!val){ showToast('Enter a valid wallet address'); return; }
  if(val.length < 6){ showToast('Wallet address looks too short'); return; }
  if(me && me.wallets && me.wallets[id]){ showToast('Wallet already connected and locked'); closeWalletSheet(); return; }
  const doSave = ()=>{
    // write-once: transaction only writes if nothing is stored yet
    db.ref('users/'+uid+'/wallets/'+id).transaction(cur => cur ? undefined : val, (err, committed)=>{
      if(err){ showToast('Something went wrong. Please try again.'); return; }
      if(!committed){ showToast('Wallet already connected and locked'); closeWalletSheet(); return; }
      showToast((m.name||'Wallet')+' connected!');
      closeWalletSheet();
    });
  };
  const msg = 'Connect ' + maskAddr(val) + ' to ' + (m.name||'this method') + '?\n\nThis is permanent. You will not be able to edit, change or remove it.';
  if(tg && tg.initData && tg.showConfirm) tg.showConfirm(msg, ok=>{ if(ok) doSave(); });
  else if(window.confirm(msg)) doSave();
}

/* ---------------- BADGES ----------------
   * "default" badge: every user owns + wears it from the very start. Admin can edit it, never delete it.
   * Every other badge is LOCKED until: the admin's unlock rule is reached, or the admin grants it.
   ---------------------------------------------------------------- */
const DEFAULT_BADGE_ID = 'default';
const DEFAULT_BADGE = {
  name: 'Starter', imageUrl: '', imageType: 'emoji', emoji: '⭐',
  isDefault: true,
  normalReferCount: 0, normalReferCommission: 0,
  activeReferCount: 0, activeReferCommission: 0,
  depositFeePercent: 0, withdrawFeePercent: 0, depositSwapPercent: 0,
  minerLevelMin: 0, minerLevelMax: 0,
  maxWalletConnect: 0,
  reqDepositBalance: 0, reqTotalDeposit: 0, customRequired: ''
};
/* Renders a badge's icon: an emoji (if the admin picked that) or the direct-link image, else a fallback. */
function badgeIconHtml(b, cls){
  if(b && b.imageType==='emoji' && b.emoji){
    return `<div class="${cls}" style="display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1;">${esc(b.emoji)}</div>`;
  }
  return logoBox(b && b.imageUrl, '🔰', cls);
}
// all badges, default first (works even if admin never created it in the DB yet)
function allBadges(){
  const out = {};
  out[DEFAULT_BADGE_ID] = Object.assign({}, DEFAULT_BADGE, badgesCache[DEFAULT_BADGE_ID] || {}, { isDefault: true });
  Object.keys(badgesCache).forEach(id=>{ if(id !== DEFAULT_BADGE_ID) out[id] = badgesCache[id]; });
  return out;
}
function activeBadgeId(){
  const all = allBadges();
  return (me && me.badge && all[me.badge]) ? me.badge : DEFAULT_BADGE_ID;
}
// PATH: this always reads the badge id straight off the user's own record (me.badge), looks it
// up in the live badges list, and returns that badge's object — so whatever % the admin set on
// THAT badge (ref commission, fees, boosts...) is exactly what this user gets, everywhere below.
function myBadge(){
  return allBadges()[activeBadgeId()] || DEFAULT_BADGE;
}
// Deposit balance -> CRTA: the % of the swapped deposit balance the user KEEPS (the rest is deducted).
// It comes from the active badge's "Deposit swap %". CRTA -> USD is NOT affected by badges (admin rate only).
function depositSwapPct(){
  return Math.max(0, Math.min(100, Number(myBadge().depositSwapPercent) || 0));
}
// how many wallets the user's active badge lets them connect (0 = no limit)
function myMaxWalletConnect(){
  return Math.max(0, Number(myBadge().maxWalletConnect) || 0);
}
function badgeLabel(u){
  const all = allBadges();
  return (all[(u && u.badge) || DEFAULT_BADGE_ID] || all[DEFAULT_BADGE_ID]).name || 'Miner';
}
function activeBadgeFor(u){
  const all = allBadges();
  return all[(u && u.badge) || DEFAULT_BADGE_ID] || all[DEFAULT_BADGE_ID];
}
// small inline icon for whichever badge the user actually has equipped — emoji or direct-link image, whichever is set
function badgeIconInlineHtml(u){
  const b = activeBadgeFor(u);
  if(!b) return '';
  if(b.imageType==='emoji' && b.emoji) return `<span class="name-badge-emoji">${esc(b.emoji)}</span>`;
  if(b.imageUrl) return `<img class="name-badge-img" src="${esc(b.imageUrl)}" alt="" onerror="this.remove()">`;
  return '';
}
// display name with the user's current badge (emoji or image) appended, e.g. "Xushar💸"
function nameWithBadgeHtml(u){
  return `${esc(displayName(u))}${badgeIconInlineHtml(u)}`;
}
function isBadgeUnlocked(id){
  if(id === DEFAULT_BADGE_ID) return true;
  return !!me && (!!(me.unlockedBadges && me.unlockedBadges[id]) || me.badge === id);
}
// The badge's own "Required" numbers (set by admin) vs. the user's live stats.
// Each entry: label shown to the user, how much they have, how much they need.
// Only stat-backed requirements are checked here — custom text requirements can't be measured automatically.
function badgeRequirementChecks(b){
  const checks = [];
  if(Number(b.normalReferCount)>0) checks.push({ have: Number(me && me.referralsNormal)||0, need: Number(b.normalReferCount), label: 'normal referrals' });
  if(Number(b.activeReferCount)>0) checks.push({ have: Number(me && me.referralsActive)||0, need: Number(b.activeReferCount), label: 'active referrals' });
  if(Number(b.reqDepositBalance)>0) checks.push({ have: Number(me && me.depositBalance)||0, need: Number(b.reqDepositBalance), label: 'CRTA deposit balance' });
  if(Number(b.reqTotalDeposit)>0) checks.push({ have: Number(me && me.totalDeposit)||0, need: Number(b.reqTotalDeposit), label: 'CRTA total deposited' });
  return checks;
}
// true once every stat-based requirement on the badge is met — this is what unlocks the
// "Watch 1 ad to unlock" button. (Custom text requirements are informational only.)
function badgeRequirementsMet(b){
  if(!me) return false;
  return badgeRequirementChecks(b).every(c => c.have >= c.need);
}
function fmtProg(n){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:2}); }
// Auto-generated text — the admin never types this. It's built straight from the badge's
// field values, mirroring the exact same generator used on the admin side.
function badgeRequiredParts(b){
  const parts = [];
  if(Number(b.normalReferCount)>0) parts.push(b.normalReferCount+' normal referrals');
  if(Number(b.activeReferCount)>0) parts.push(b.activeReferCount+' active referrals');
  if(Number(b.minerLevelMin)>0 || Number(b.minerLevelMax)>0) parts.push('Miner level '+(b.minerLevelMin||0)+'–'+(b.minerLevelMax||0)+' access');
  if(Number(b.maxWalletConnect)>0) parts.push('Max '+b.maxWalletConnect+' wallet'+(b.maxWalletConnect==1?'':'s')+' connect');
  if(Number(b.reqDepositBalance)>0) parts.push('Current deposit balance ≥ '+b.reqDepositBalance+' CRTA');
  if(Number(b.reqTotalDeposit)>0) parts.push('Total deposited ≥ '+b.reqTotalDeposit+' CRTA');
  if(b.customRequired) parts.push(b.customRequired);
  return parts;
}
function badgeBenefitParts(b){
  const parts = [];
  if(Number(b.normalReferCommission)>0) parts.push(b.normalReferCommission+'% commission per normal referral');
  if(Number(b.activeReferCommission)>0) parts.push(b.activeReferCommission+'% commission per active referral');
  if(Number(b.depositFeePercent)>0) parts.push('Deposit fee '+b.depositFeePercent+'%');
  if(Number(b.withdrawFeePercent)>0) parts.push('Withdraw fee '+b.withdrawFeePercent+'%');
  if(Number(b.depositSwapPercent)>0) parts.push('Deposit → CRTA swap '+b.depositSwapPercent+'%');
  if(Number(b.minerLevelMin)>0 || Number(b.minerLevelMax)>0) parts.push('Unlocks miner level '+(b.minerLevelMin||0)+'–'+(b.minerLevelMax||0));
  if(Number(b.maxWalletConnect)>0) parts.push('Connect up to '+b.maxWalletConnect+' wallet'+(b.maxWalletConnect==1?'':'s'));
  return parts;
}
// short, user-facing summary of what a badge actually gives — shown on every badge card
function badgePerksHtml(b){
  const parts = badgeBenefitParts(b);
  return parts.length ? `<div class="bi-perks">${parts.map(p=>`<span class="bi-perk-chip">${esc(p)}</span>`).join('')}</div>` : '';
}
function badgeRowHtml(id, b){
  const isActive = activeBadgeId() === id;
  const unlocked = isBadgeUnlocked(id);
  const checks = unlocked ? [] : badgeRequirementChecks(b);
  const requirementsMet = unlocked || badgeRequirementsMet(b);
  const reqParts = badgeRequiredParts(b);
  const req  = (!unlocked && reqParts.length) ? `<div class="bi-req">Required: ${esc(reqParts.join(' · '))}</div>` : '';
  const prog = (!unlocked && checks.length) ? `<div class="bi-req">Progress: ${checks.map(c=>fmtProg(Math.min(c.have,c.need))+' / '+fmtProg(c.need)+' '+esc(c.label)).join(' · ')}</div>` : '';
  const desc = '';
  const perks = badgePerksHtml(b);
  let btn;
  if(isActive)              btn = `<button class="bi-btn current" disabled>Current</button>`;
  else if(unlocked)         btn = `<button class="bi-btn select" data-id="${esc(id)}" onclick="selectBadge(this.dataset.id)">Select</button>`;
  else if(requirementsMet)  btn = `<button class="bi-btn watchad" id="badge-watchad-${esc(id)}" data-id="${esc(id)}" onclick="watchAdToUnlockBadge(this.dataset.id)">${lockSvg}<span>Watch 1 ad to unlock</span></button>`;
  else                      btn = `<button class="bi-btn locked" disabled>${lockSvg} Locked</button>`;
  return `
    <div class="badge-item${isActive?' active':''}${unlocked?'':' locked'}">
      ${badgeIconHtml(b, 'bi-icon')}
      <div class="bi-body">
        <div class="bi-name">${esc(b.name||'Level')}</div>
        ${desc}${req}${prog}${perks}
      </div>
      ${btn}
    </div>`;
}
// user taps the lock -> watches one rewarded ad -> the badge is unlocked PERMANENTLY (never re-locks),
// then they can hit Select like any other unlocked badge.
function watchAdToUnlockBadge(id){
  const all = allBadges();
  const b = all[id];
  if(!b || isBadgeUnlocked(id)) return;
  if(!badgeRequirementsMet(b)){ showToast('You have not met the requirements for this level yet'); renderBadges(); return; }
  const btn = document.getElementById('badge-watchad-'+id);
  if(btn){ btn.disabled = true; btn.classList.add('ad-loading'); }
  showActiveRewardedAd().then(()=>{
    return db.ref('users/'+uid+'/unlockedBadges/'+id).set(true);
  }).then(()=>{
    showToast((b.name||'Level') + ' unlocked! Tap Select to wear it.');
    renderBadges();
  }).catch(err=>{
    if(btn){ btn.disabled = false; btn.classList.remove('ad-loading'); }
    if(err && err.message==='ad-not-configured'){
      showToast('Ads are not set up yet — please try again later');
    } else {
      showToast('Ad was not completed — try again');
    }
  });
}
function renderBadges(){
  const box = document.getElementById('badge-list');
  if(!box) return;
  const all = allBadges();
  box.innerHTML = Object.keys(all).map(id=>badgeRowHtml(id, all[id])).join('');
  if(me) renderProfile();
}
function selectBadge(id){
  const all = allBadges();
  if(!all[id]) return;
  if(!isBadgeUnlocked(id)){ showToast('This level is still locked'); return; }
  db.ref('users/'+uid).update({badge:id}).then(()=>{
    showToast((all[id].name || 'Level') + ' is now your active level!');
  });
}

/* ---------------- REFER ---------------- */
/* "You joined with code XXXX — invited by @username": looked up from users/<referredBy> so it also works for old accounts */
let invitedByCache = {};      // referrerUid -> {code, name}
let invitedByLoading = {};
function renderInvitedBy(){
  const card = document.getElementById('invited-by-card');
  if(!card) return;
  const rid = me && me.referredBy ? String(me.referredBy) : '';
  if(!rid){ card.style.display = 'none'; return; }
  const c = invitedByCache[rid];
  if(!c){
    card.style.display = 'none';
    if(invitedByLoading[rid]) return;
    invitedByLoading[rid] = true;
    Promise.all(['referralCode','username','firstName'].map(k => db.ref('users/'+rid+'/'+k).get().then(s => s.exists() ? String(s.val()||'') : '')))
      .then(([code, uname, first]) => {
        invitedByCache[rid] = { code: code || '—', name: uname ? '@'+uname : (first || 'Your referrer') };
      })
      .catch(()=>{ invitedByCache[rid] = { code:'—', name:'Your referrer' }; })
      .finally(()=>{ invitedByLoading[rid] = false; renderInvitedBy(); });
    return;
  }
  document.getElementById('invited-code').textContent = c.code;
  document.getElementById('invited-name').textContent = 'Invited by ' + c.name;
  card.style.display = 'flex';
}
function renderRefer(){
  renderInvitedBy();
  // withdraw commission now comes from the user's own badge, not the old global setting
  const b = myBadge();
  const rateEl = document.getElementById('refer-commission-rate');
  rateEl.textContent = (Number(b.normalReferCommission)||0)+'%/'+(Number(b.activeReferCommission)||0)+'%';
  rateEl.title = 'Normal referral commission '+(Number(b.normalReferCommission)||0)+'% · Active referral commission '+(Number(b.activeReferCommission)||0)+'% (from your current level: '+esc(b.name||'')+')';
  document.getElementById('refer-earned').textContent = '$'+(me.referEarned||0).toFixed(2)+' USD';
  document.getElementById('refer-total').textContent = me.referralsNormal||0;
  document.getElementById('refer-active').textContent = me.referralsActive||0;
  document.getElementById('refer-earn-stat').textContent = (me.referEarned||0).toFixed(2);
  const linkEl = document.getElementById('refer-link');
  if(linkEl) linkEl.textContent = referralLink() || 'Link not set up yet';
  const list = me.referrals ? Object.values(me.referrals) : [];
  list.sort((a,b)=>(b.joinedAt||0)-(a.joinedAt||0));
  const box = document.getElementById('ref-list');
  if(!list.length){ box.innerHTML = '<div class="empty-state">No referrals yet — share your code!</div>'; return; }
  box.innerHTML = list.map(r=>{
    const isActive = r.status==='active';
    const when = r.joinedAt
      ? new Date(r.joinedAt).toLocaleString(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})
      : '';
    const sub = [r.username ? '@'+r.username : '', when ? 'Joined '+when : ''].filter(Boolean).join(' · ');
    return `
    <div class="ref-list-row">
      <div class="lb-avatar">${avatarInner(r.photoUrl, (r.name||r.username||'U').charAt(0).toUpperCase())}</div>
      <div class="lb-info"><div class="lb-name">${esc(r.name||r.username||'User')}</div><div class="lb-sub">${esc(sub)}</div></div>
      <div style="text-align:right;">
        <span class="status-pill ${isActive?'active':'normal'}">${isActive?'Active':'Normal'}</span>
      </div>
    </div>`;
  }).join('');
}
function tgEsc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function tgNotify(chatId, html){
  const token = String(settings.botToken||'').trim();
  if(!token || !chatId || IS_GUEST) return Promise.resolve(false);
  return fetch('https://api.telegram.org/bot'+token+'/sendMessage', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode:'HTML', disable_web_page_preview: true })
  }).then(r=>r.json()).then(j=>!!(j && j.ok)).catch(()=>false);
}
async function notifyNewReferral(referrerUid, joined){
  try{
    const snap = await db.ref('users/'+referrerUid).get();
    const r = snap.val() || {};
    const rName = tgEsc(r.firstName || r.username || 'there');
    const jTag = joined.username ? '@'+tgEsc(joined.username) : tgEsc(joined.first_name || 'Someone');
    const d = new Date(), p = n => String(n).padStart(2,'0');
    const date = p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+p(d.getFullYear()%100);
    await tgNotify(referrerUid,
      '👋 <b>Hello '+rName+'!</b>\n\n'+
      '🎉 <b>New Referral!</b>\n\n'+
      '🤝 Your Referral '+jTag+' joined on <b>'+date+'</b>\n\n'+
      '✅ Now is your <b>Normal Referral</b>\n\n'+
      '🚀 Keep sharing your link to grow your network with <b>CRYPTENA</b>!');
  }catch(e){}
}
/* LATE REFERRAL — an account that already exists but never joined through anyone can still use ONE
   referral link, any time. The bot only records the click (pendingReferrals/<uid>); this applies it.
   • claims users/<uid>/referredBy with a transaction, so it can only ever be set once
   • same counters the new-user path uses (referralsNormal / referrals/<uid>), and if this user has
     already deposited before, the referral is marked "active" straight away
   • refuses: self, referrer without wallet, or a referrer from the user's own downline (loop) */
let lateRefBusy = false;
async function applyLateReferral(){
  if(IS_GUEST || lateRefBusy || !uid) return;
  lateRefBusy = true;
  try{
    const mineSnap = await db.ref('users/'+uid).get();
    const mine = mineSnap.val() || {};
    if(mine.referredBy) return;                                   // already has a referrer — nothing to do
    const pendSnap = await db.ref('pendingReferrals/'+uid).get();
    const pr = pendSnap.exists() ? pendSnap.val() : null;
    const refUid = pr && pr.referrerUid ? String(pr.referrerUid) : '';
    if(!refUid) return;

    // ---- validate (definitive "no" -> drop the pending click so the user can use another link) ----
    const drop = ()=> db.ref('pendingReferrals/'+uid).remove().catch(()=>{});
    if(refUid === uid){ await drop(); return; }
    const refSnap = await db.ref('users/'+refUid).get();
    if(!refSnap.exists() || !hasWallet({wallets: (refSnap.val()||{}).wallets || {}})){ await drop(); return; }
    let cur = refUid, loop = false;
    for(let i=0; i<25 && cur; i++){
      const ps = await db.ref('users/'+cur+'/referredBy').get();
      const parent = ps.exists() ? String(ps.val()||'') : '';
      if(parent === uid){ loop = true; break; }
      cur = parent;
    }
    if(loop){ await drop(); return; }

    // ---- claim (atomic: only succeeds while referredBy is still empty) ----
    const tx = await db.ref('users/'+uid+'/referredBy').transaction(v => v ? undefined : refUid);
    if(!tx.committed) return;

    const alreadyDeposited = Number(mine.totalDeposit||0) > 0;
    const up = {};
    up['users/'+refUid+'/referralsNormal'] = SERVER_INC(1);
    if(alreadyDeposited) up['users/'+refUid+'/referralsActive'] = SERVER_INC(1);
    up['users/'+refUid+'/referrals/'+uid] = {
      name: (tgUser.first_name||tgUser.username||'New user'),
      username: tgUser.username || '',
      photoUrl: tgUser.photo_url || '',
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
      status: alreadyDeposited ? 'active' : 'normal'
    };
    up['pendingReferrals/'+uid] = null;
    await db.ref().update(up);
    notifyNewReferral(refUid, tgUser);
    showToast('Referral applied to your account!');
  }catch(e){
    console.error('applyLateReferral', e);
  }finally{
    lateRefBusy = false;
  }
}

// Telegram deep link:  https://t.me/<bot>?start=ref_<CODE>
// Opens the BOT chat (not the mini app). Telegram shows just "/start" in the chat, but the bot receives
// "/start ref_<CODE>", saves it to pendingReferrals/<uid>, and boot() links it when the user opens the app.
// (Old links  ?startapp=<CODE>  still work — boot() still reads tg.initDataUnsafe.start_param.)
function referralLink(){
  const code = me && me.referralCode;
  const bot = String(settings.botUsername || '').replace(/^@/,'').trim();
  if(!code || !bot) return '';
  return `https://t.me/${bot}?start=ref_${encodeURIComponent(code)}`;
}
function copyRefLink(){
  const link = referralLink();
  if(!link){ showToast('Referral link is not set up yet (admin: set Bot username)'); return; }
  copyText(link, 'Referral link copied!');
}
function shareOnTelegram(){
  const link = referralLink();
  if(!link){ showToast('Referral link is not set up yet (admin: set Bot username)'); return; }
  const text = 'Join me on Cryptena and start earning! 🚀';
  const tgUrl = 'https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(text);
  if(tg && tg.openTelegramLink){ tg.openTelegramLink(tgUrl); } else { window.open(tgUrl,'_blank'); }
}
function openExternal(url, emptyMsg){
  url = String(url||'').trim();
  if(!url){ showToast(emptyMsg || 'Link not available yet'); return; }
  if(tg && /^https?:\/\/t\.me\//i.test(url) && tg.openTelegramLink) tg.openTelegramLink(url);
  else if(tg && tg.openLink) tg.openLink(url);
  else window.open(url,'_blank');
}

/* Whenever this user's balance crosses the "active referral" threshold for the first time,
/* Active-referral promotion now happens admin-side, the moment a user's first
   deposit is accepted (see decideDeposit in the admin app) — not from tasks or
   mining. Kept as a no-op stub so any old call sites stay harmless. */
function maybePromoteReferralActive(){ /* no-op — see admin app.js decideDeposit() */ }

/* ---------------- MINERS ----------------
   Each miner (admin-defined, at miners/{id}) has a rate/rateUnit and a capHours worth
   of CRTA it can hold before it must be claimed. Only one miner can mine at a time —
   users/{uid}/miner holds {id, active, startedAt, cooldownUntil}. Claiming requires
   watching claimAdsRequired rewarded ads (with a break between each), banks the stored
   amount into crpt/totalMining, and starts a fresh accumulation cycle with a cooldown
   before the next claim. Unowned miners are unlocked either by price (CRTA) or by
   watching ads, gated behind an optional referral count. */
function minerRatePerHour(m){ return m.rateUnit==='minute' ? Number(m.rate||0)*60 : Number(m.rate||0); }
function minerCapAmount(m){ return minerRatePerHour(m) * Number(m.capHours||0); }
function isMinerOwned(id, m){ return !!(m && m.isDefault) || !!(me && me.ownedMiners && me.ownedMiners[id]); }
function minerReq(m){
  const ads = m.buyType==='ad' ? (Number(m.buyAdsRequired)||1) : (m.buyType==='price' ? 0 : (Number(m.buyAdsRequired)||0));
  return {
    price: Number(m.price)||0,
    ads, adBreak: Number(m.buyAdBreakSeconds)||0,
    active: Number(m.referActiveRequired)||0,
    normal: Number(m.referNormalRequired!=null ? m.referNormalRequired : m.referRequired)||0
  };
}
// Auto-generated from the admin's numeric fields — same wording as the admin side.
function minerRequirementChecks(m){
  const r = minerReq(m), out = [];
  const dep = Number(me && me.depositBalance)||0;
  const act = Number(me && me.referralsActive)||0, nor = Number(me && me.referralsNormal)||0;
  if(r.price>0)   out.push({ text:'Price '+fmtProg(r.price)+' CRTA (deposit balance)', have:dep, need:r.price });
  if(r.active>0)  out.push({ text:r.active+' active referral'+(r.active>1?'s':''), have:act, need:r.active });
  if(r.normal>0)  out.push({ text:r.normal+' normal referral'+(r.normal>1?'s':''), have:nor, need:r.normal });
  if(r.ads>0)     out.push({ text:'Watch '+r.ads+' ad'+(r.ads>1?'s':'')+(r.ads>1&&r.adBreak>0?' · '+r.adBreak+'s break':'') });
  return out;
}
function minerReqsMet(m){ return minerRequirementChecks(m).every(c => c.need==null || c.have>=c.need); }
function activeMinerId(){ return (me && me.miner && me.miner.active) ? me.miner.id : null; }
function activeMinerConfig(){ const id = activeMinerId(); return id ? minersCache[id] : null; }
function minerIdsSorted(){
  return Object.keys(minersCache).filter(id=>minersCache[id]).sort((a,b)=>{
    const A = minersCache[a], B = minersCache[b];
    if(!!B.isDefault !== !!A.isDefault) return (B.isDefault?1:0)-(A.isDefault?1:0);
    return (Number(A.level)||0)-(Number(B.level)||0);
  });
}
function defaultMinerId(){ return minerIdsSorted()[0] || null; }
function selectedMinerId(){
  const id = me && me.miner && me.miner.id;
  if(id && minersCache[id] && isMinerOwned(id, minersCache[id])) return id;
  return defaultMinerId();
}
function selectedMinerConfig(){ const id = selectedMinerId(); return id ? minersCache[id] : null; }
// Claim rule: a miner can only be claimed once its stored amount has reached the cap (cap > 0 and stored == cap).
function minerIsFull(cfg){
  cfg = cfg || activeMinerConfig();
  if(!cfg || !me || !me.miner || !me.miner.startedAt) return false;
  const cap = minerCapAmount(cfg);
  return cap > 0 && minerStoredAmount() >= cap - 1e-12;
}
function minerStoredAmount(){
  const cfg = activeMinerConfig();
  if(!cfg || !me.miner.startedAt) return 0;
  const elapsed = Math.max(0, (Date.now() - me.miner.startedAt)/1000);
  return Math.min(minerCapAmount(cfg), (minerRatePerHour(cfg)/3600)*elapsed);
}
function watchAdsSequence(count, breakSeconds, onProgress){
  count = Math.max(1, count||1);
  let p = Promise.resolve();
  for(let i=0;i<count;i++){
    const n = i+1;
    p = p.then(()=> { if(onProgress) onProgress(n, count, 'watching'); return showActiveRewardedAd(); });
    p = p.then(()=> { if(onProgress) onProgress(n, count, 'done'); });
    if(i < count-1 && breakSeconds>0) p = p.then(()=> new Promise(res=> setTimeout(res, breakSeconds*1000)));
  }
  return p;
}
function minerStatRows(m){
  const rate = minerRatePerHour(m), cap = minerCapAmount(m);
  const ads = Number(m.claimAdsRequired)||1, brk = Number(m.claimBreakSeconds)||0;
  return `
    <div class="mn-stat"><span>Rate</span><b>${rate.toFixed(4)}/hr</b></div>
    <div class="mn-stat"><span>Cap</span><b>${cap.toFixed(4)} · ${Number(m.capHours)||0}h</b></div>
    <div class="mn-stat"><span>Claim</span><b>${ads} ad${ads>1?'s':''}${ads>1&&brk>0?' · '+brk+'s break':''}</b></div>
    <div class="mn-stat"><span>Cooldown</span><b>${Number(m.cooldownMin)||0}m</b></div>`;
}
function minerUnlockHtml(m){
  const checks = minerRequirementChecks(m);
  const lines = checks.length ? checks.map(c=>{
    if(c.need==null) return '<div class="mn-req">'+esc(c.text)+'</div>';
    const ok = c.have >= c.need;
    return '<div class="mn-req '+(ok?'ok':'no')+'"><span>'+(ok?'✓':'✗')+'</span>'+esc(c.text)+' <em>'+fmtProg(Math.min(c.have,c.need))+'/'+fmtProg(c.need)+'</em></div>';
  }).join('') : '<div class="mn-req ok"><span>✓</span>Free</div>';
  return '<div class="mn-unlock"><div class="mn-unlock-t">Required</div>'+lines+'</div>';
}
function minerRowHtml(id, m){
  const selected = selectedMinerId() === id;
  const owned = isMinerOwned(id, m);
  let btn;
  if(selected) btn = `<button class="task-btn done" disabled>Selected</button>`;
  else if(owned && activeMinerId()) btn = `<button class="task-btn locked" disabled title="Miner can't be changed while mining is active">Mining active</button>`;
  else if(owned) btn = `<button class="task-btn" data-id="${esc(id)}" onclick="selectMiner(this.dataset.id)">Select</button>`;
  else if(!minerReqsMet(m)) btn = `<button class="task-btn locked" disabled>Locked</button>`;
  else { const r = minerReq(m); btn = `<button class="task-btn" id="miner-unlock-${esc(id)}" data-id="${esc(id)}" onclick="unlockMiner(this.dataset.id)">${r.ads>0?'Unlock':(r.price>0?'Buy':'Get')}</button>`; }
  return `
    <div class="mn-card${selected?' selected':''}${owned?'':' locked'}">
      <div class="mn-head">
        ${logoBox(m.image, (m.name||'M').charAt(0).toUpperCase(), 'task-icon')}
        <div class="mn-title">
          <div class="mn-name">${esc(m.name||'Miner')}</div>
          <div class="mn-lv">Lv.${Number(m.level)||0}${m.isDefault?' · Default':''}</div>
        </div>
      </div>
      ${m.ability?`<div class="mn-ability">${esc(m.ability)}</div>`:''}
      <div class="mn-stats">${minerStatRows(m)}</div>
      ${owned?'':minerUnlockHtml(m)}
      ${btn}
    </div>`;
}
function renderMinersList(){
  const box = document.getElementById('miner-list');
  if(!box) return;
  const ids = minerIdsSorted();
  box.innerHTML = ids.map(id=>minerRowHtml(id, minersCache[id])).join('') || '<div class="empty-hint" style="grid-column:1/-1;">No miners available yet</div>';
}
function unlockMiner(id){
  const m = minersCache[id];
  if(!m || isMinerOwned(id,m)) return;
  if(!minerReqsMet(m)){ showToast('Requirements not met yet'); return; }
  const r = minerReq(m);
  const btn = document.getElementById('miner-unlock-'+id);
  const finish = ()=>{
    if(!minerReqsMet(m)){ showToast('Requirements not met yet'); return null; }
    const updates = { ['users/'+uid+'/ownedMiners/'+id]: true };
    if(r.price > 0) updates['users/'+uid+'/depositBalance'] = SERVER_INC(-r.price);
    return db.ref().update(updates).then(()=>{
      showToast((m.name||'Miner')+' unlocked!');
      if(r.price > 0) pushTx('mining', 'Bought '+(m.name||'miner'), -r.price);
    });
  };
  if(r.ads <= 0){ finish(); return; }
  if(btn){ btn.disabled = true; btn.textContent = 'Watching…'; }
  watchAdsSequence(r.ads, r.adBreak).then(finish).catch(err=>{
    if(btn){ btn.disabled = false; btn.textContent = 'Unlock'; }
    showToast(err && err.message==='ad-not-configured' ? 'Ads are not set up yet — please try again later' : 'Ad was not completed — try again');
  });
}
function selectMiner(id){
  const m = minersCache[id];
  if(!m) return;
  if(!isMinerOwned(id,m)){ showToast('Unlock this miner first'); return; }
  if(selectedMinerId() === id) return;
  // Miner is locked while mining is active — it can't be switched mid-run.
  if(activeMinerId()){ showToast("Can't change miner while mining is active"); return; }
  db.ref('users/'+uid+'/miner/id').set(id).then(()=>showToast((m.name||'Miner')+' selected'));
}
function minerCooldownLeft(){ return Math.max(0, ((me && me.miner && me.miner.cooldownUntil)||0) - Date.now()); }
function fmtCooldown(ms){
  const mi = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
  return String(mi).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
let startBusy = false;
function startMining(){
  if(startBusy) return;
  const id = selectedMinerId();
  if(!id){ showToast('No miner available'); return; }
  if(!requireWallet('start mining')) return;
  if(minerCooldownLeft() > 0){ showToast('Wait for the cooldown to finish'); return; }
  startBusy = true;
  db.ref('users/'+uid+'/miner').set({ id, active:true, startedAt:Date.now(), cooldownUntil:0 })
    .then(()=>showToast('Mining started!'))
    .catch(()=>showToast('Could not start mining, try again'))
    .then(()=>{ startBusy = false; });
}
function mineAction(){
  if(!hasWallet()){ requireWallet('start mining'); return; }
  if(!activeMinerConfig()){ startMining(); return; }
  openClaimSheet();
}
function renderMiningStatic(){
  if(!me) return;
  resumeMining();
  renderMinersList();
}
let caveSkinKey = null;
function syncCaveSkin(cfg){
  const key = cfg ? (cfg.skin||'') : '';
  if(key === caveSkinKey) return;
  caveSkinKey = key;
  if(window.MiningCave) window.MiningCave.setSkin(cfg && cfg.skin);
}
function setStageCounter(v){
  document.getElementById('miner-stage-counter').textContent = '+'+Math.max(0,v||0).toFixed(8);
}
function setStageProgress(pct){
  document.getElementById('miner-progress-fill').style.width = Math.max(0,Math.min(100,pct||0)).toFixed(2)+'%';
}
function resumeMining(){
  clearInterval(miningTickInterval);
  const m = me && me.miner;
  if(m && m.active && Number(m.cooldownUntil||0) > Date.now()){
    db.ref('users/'+uid+'/miner').update({ active:false, startedAt:null });
    return;
  }
  miningTickInterval = setInterval(tickMining, 1000);
  tickMining();
}
function tickMining(){
  if(!me) return;
  const btn = document.getElementById('mine-btn');
  const stage = document.getElementById('miner-stage');
  const bar = document.getElementById('miner-progress');
  const cfg = activeMinerConfig();
  const cave = window.MiningCave;
  if(!cfg){
    btn.classList.remove('mining'); stage.classList.remove('active');
    bar.classList.add('idle'); bar.classList.remove('full');
    const sel = selectedMinerConfig();
    if(cave){ cave.setResting(true); cave.setPaused(false); }
    syncCaveSkin(sel);
    setStageCounter(0); setStageProgress(0);
    if(claimBusy) return;
    if(!sel){ btn.disabled = true; btn.textContent = 'No miner available'; return; }
    const left = minerCooldownLeft();
    if(left > 0){ btn.disabled = true; btn.textContent = 'Cooldown '+fmtCooldown(left); return; }
    btn.disabled = false;
    btn.textContent = hasWallet() ? 'Start mining' : 'Connect wallet';
    return;
  }
  btn.classList.add('mining'); stage.classList.add('active');
  bar.classList.remove('idle');
  syncCaveSkin(cfg);
  const cap = minerCapAmount(cfg);
  const stored = minerStoredAmount();
  const full = cap > 0 && stored >= cap - 1e-12;
  setStageCounter(stored);
  setStageProgress(cap > 0 ? (stored/cap*100) : 0);
  bar.classList.toggle('full', full);
  if(cave){ cave.setResting(false); cave.setPaused(full); }
  if(claimBusy) return;
  if(!full){ btn.textContent = 'Mining…'; btn.disabled = true; return; }   // still filling up — no claim yet
  const ads = claimAdsTotal(cfg);
  btn.textContent = 'Watch '+ads+' ad'+(ads>1?'s':'')+' to claim';
  btn.disabled = false;
}

/* ---- Claim dialog: watch ads x/y, then Claim ---- */
let claimBusy = false, claimAdBusy = false, claimAdsDone = 0, claimBreakUntil = 0, claimSheetTimer = null;
function claimAdsTotal(cfg){ return Math.max(1, Number(cfg && cfg.claimAdsRequired)||1); }
function claimAdsKey(){ return uid+':'+(me && me.miner && me.miner.startedAt || 0)+':full'; }
function claimAdsLoad(){
  claimAdsDone = 0;
  try{
    const raw = JSON.parse(localStorage.getItem('cryptena_claim_ads')||'null');
    if(raw && raw.key === claimAdsKey()) claimAdsDone = Number(raw.count)||0;
  }catch(e){}
}
function claimAdsSave(){
  try{ localStorage.setItem('cryptena_claim_ads', JSON.stringify({ key: claimAdsKey(), count: claimAdsDone })); }catch(e){}
}
function claimAdsClear(){ try{ localStorage.removeItem('cryptena_claim_ads'); }catch(e){} claimAdsDone = 0; claimBreakUntil = 0; }
function openClaimSheet(){
  const cfg = activeMinerConfig();
  if(!cfg || minerCooldownLeft() > 0 || minerStoredAmount() <= 0) return;
  if(!minerIsFull(cfg)){ showToast('You can claim once the cap is full'); return; }
  claimAdsLoad();
  renderClaimSheet();
  document.getElementById('sheet-claim').classList.add('active');
  clearInterval(claimSheetTimer);
  claimSheetTimer = setInterval(renderClaimSheet, 500);
}
function closeClaimSheet(){
  if(claimBusy) return;
  document.getElementById('sheet-claim').classList.remove('active');
  clearInterval(claimSheetTimer);
}
function renderClaimSheet(){
  const cfg = activeMinerConfig();
  if(!cfg){ closeClaimSheet(); return; }
  const total = claimAdsTotal(cfg);
  const done = Math.min(claimAdsDone, total);
  document.getElementById('claim-sheet-title').textContent = 'Watch '+total+' ad'+(total>1?'s':'')+' to claim';
  document.getElementById('claim-count').textContent = done+'/'+total;
  document.getElementById('claim-bar-fill').style.width = (done/total*100)+'%';
  const btn = document.getElementById('claim-action-btn');
  const breakLeft = Math.max(0, Math.ceil((claimBreakUntil - Date.now())/1000));
  if(claimBusy){ btn.disabled = true; btn.textContent = 'Claiming…'; }
  else if(claimAdBusy){ btn.disabled = true; btn.textContent = 'Loading ad…'; }
  else if(done >= total){ btn.disabled = false; btn.textContent = 'Claim '+minerStoredAmount().toFixed(4)+' CRTA'; }
  else if(breakLeft > 0){ btn.disabled = true; btn.textContent = 'Next ad in '+breakLeft+'s'; }
  else { btn.disabled = false; btn.textContent = 'Watch Ad'; }
}
function claimAction(){
  const cfg = activeMinerConfig();
  if(!cfg || claimBusy || claimAdBusy) return;
  if(!minerIsFull(cfg)){ closeClaimSheet(); return; }   // cap not reached: no ads, no claim
  if(claimAdsDone >= claimAdsTotal(cfg)) { claimMining(); return; }
  if(claimBreakUntil > Date.now()) return;
  claimAdBusy = true;
  renderClaimSheet();
  showActiveRewardedAd().then(()=>{
    claimAdsDone++;
    claimAdsSave();
    const brk = Number(cfg.claimBreakSeconds)||0;
    if(claimAdsDone < claimAdsTotal(cfg) && brk > 0) claimBreakUntil = Date.now() + brk*1000;
  }).catch(err=>{
    showToast(err && err.message==='ad-not-configured' ? 'Ads are not set up yet — please try again later' : 'Ad was not completed — try again');
  }).then(()=>{
    claimAdBusy = false;
    renderClaimSheet();
  });
}
function claimMining(){
  if(claimBusy) return;
  const cfg = activeMinerConfig();
  if(!cfg || minerCooldownLeft() > 0){ closeClaimSheet(); return; }
  if(claimAdsDone < claimAdsTotal(cfg)) return;
  if(!minerIsFull(cfg)){ closeClaimSheet(); return; }
  const finalStored = Math.min(minerCapAmount(cfg), minerStoredAmount());
  if(finalStored <= 0){ closeClaimSheet(); return; }
  claimBusy = true;
  renderClaimSheet();
  const cooldownUntil = Date.now() + (Number(cfg.cooldownMin)||0)*60000;
  db.ref().update({
    ['users/'+uid+'/crpt']: SERVER_INC(finalStored),
    ['users/'+uid+'/totalMining']: SERVER_INC(finalStored),
    ['users/'+uid+'/minedToday']: SERVER_INC(finalStored),
    ['users/'+uid+'/miner/active']: false,
    ['users/'+uid+'/miner/startedAt']: null,
    ['users/'+uid+'/miner/cooldownUntil']: cooldownUntil
  }).then(()=>{
    pushTx('mining', 'Mined with '+(cfg.name||'miner'), finalStored);
    showToast('Claimed '+finalStored.toFixed(4)+' CRTA!');
    claimAdsClear();
    claimBusy = false;
    document.getElementById('sheet-claim').classList.remove('active');
    clearInterval(claimSheetTimer);
  }).catch(()=>{
    claimBusy = false;
    showToast('Claim failed, try again');
    renderClaimSheet();
  }).then(()=>{
    resumeMining();
  });
}

/* ---------------- TASKS ---------------- */
const taskIcons = {
  join:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  refer:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M18 8v6M15 11h6"/>',
  watch:'<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z"/>',
  visit:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  generic:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'
};
let taskFlow = {};

function taskDayKey(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function taskRec(id){ return me && me.taskDaily && me.taskDaily[id]; }
function taskTodayCount(id){
  const rec = taskRec(id);
  return (rec && rec.day===taskDayKey()) ? Number(rec.count||0) : 0;
}
function taskUserCount(id, t){
  const rec = taskRec(id);
  if(!rec) return 0;
  if(t && t.autoRenew===true) return rec.day===taskDayKey() ? Number(rec.count||0) : 0;
  return Number(rec.total != null ? rec.total : (rec.count||0));
}
function taskQuantityActive(t){ return !!t && Number(t.totalQuantity||0) > 0; }
function taskDoneToday(id){
  const t = tasksCache[id];
  if(!t) return true;
  return taskUserCount(id, t) >= Number(t.perUserLimit || 1);
}
// Real-time, reload-proof timers (per user) for: the post-ad wait on Watch tasks
// ("_wait") and the post-claim cooldown/break on Watch & Visit tasks ("_break").
// Stored as a real wall-clock end timestamp so the countdown is always correct,
// even if the app is reloaded or reopened mid-wait.
function taskTimerRemain(key){
  const until = me && me.taskTimers && me.taskTimers[key];
  if(!until) return 0;
  return Math.max(0, Math.ceil((Number(until) - Date.now())/1000));
}
function taskBreakRemain(id){ return taskTimerRemain(id+'_break'); }
function taskWaitInfo(id){
  const until = me && me.taskTimers && me.taskTimers[id+'_wait'];
  if(!until) return null;
  return { remain: taskTimerRemain(id+'_wait'), ready: taskTimerRemain(id+'_wait') <= 0 };
}
// Ticks every second so live countdowns (wait / break) move without a full re-render.
setInterval(()=>{
  Object.entries(tasksCache).forEach(([id,t])=>{
    if(t && t.category==='watch') updateTaskBtn(id, watchButtonHtml(id,t));
    else if(t && t.category==='visit') updateTaskBtn(id, visitButtonHtml(id,t));
  });
}, 1000);
async function archiveTask(id, t){
  await db.ref('taskHistory/'+id).set(Object.assign({}, t, { endedAt: firebase.database.ServerValue.TIMESTAMP, endReason: 'quantity' }));
  await db.ref('tasks/'+id).remove();
}
async function reserveTaskSlot(t, id){
  if(!taskQuantityActive(t)) return {};
  const res = await db.ref('tasks/'+id).transaction(cur=>{
    if(!cur) return cur;
    const total = Number(cur.totalQuantity||0);
    const used = Number(cur.usedQuantity||0);
    if(total>0){
      if(used + Number(cur.reserved||0) >= total) return;
      cur.usedQuantity = used+1;
    }
    return cur;
  });
  if(!res.committed || !res.snapshot.exists()) return null;
  const v = res.snapshot.val();
  return { final: (Number(v.totalQuantity||0)>0 && Number(v.usedQuantity||0) >= Number(v.totalQuantity)) ? v : null };
}
// Starts the post-claim break/cooldown (Watch & Visit only) as a persisted real timestamp.
async function applyTaskBreak(t, id){
  if((t.category==='watch' || t.category==='visit') && Number(t.breakSeconds||0) > 0){
    await db.ref('users/'+uid+'/taskTimers/'+id+'_break').set(Date.now() + Number(t.breakSeconds)*1000);
  }
}
async function creditTask(t, id){
  const slot = await reserveTaskSlot(t, id);
  if(!slot){ showToast('This task is no longer available'); renderTasks(); return; }
  const reward = Number(t.reward||0);
  const rec = taskRec(id) || {};
  const total = Number(rec.total != null ? rec.total : (rec.count||0)) + 1;
  await db.ref('users/'+uid).update({ crpt: SERVER_INC(reward), totalTask: SERVER_INC(1) });
  await db.ref('users/'+uid+'/taskDaily/'+id).set({ day: taskDayKey(), count: taskTodayCount(id)+1, total });
  pushTx('task', t.name, reward, 'CRTA');
  showToast('+'+reward+' CRTA claimed!');
  maybePromoteReferralActive();
  if(slot.final) await archiveTask(id, slot.final);
  await applyTaskBreak(t, id);
  renderTasks();
}
function updateTaskBtn(id, html){
  const card = document.querySelector('.task-card[data-task-id="'+id+'"]');
  if(!card) return;
  const btn = card.querySelector('.task-btn');
  if(btn) btn.outerHTML = html;
}

function switchTaskTab(tab){
  currentTaskTab = tab;
  document.querySelectorAll('#page-task .task-tabs .task-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  renderTasks();
}
// Pending / accepted / rejected social submissions are shown in Profile → Transactions (txlog status).
// Here we only need to know if one is still pending so the task button can't be submitted twice.
function socialPendingFor(taskId){
  return Object.values(userSocialCache.pending||{}).some(x=>x && x.taskId===taskId);
}
function renderTasks(){
  const box = document.getElementById('task-list');
  if(!box) return;
  const entries = Object.entries(tasksCache).filter(([id,t])=>(currentTaskTab==='all' || t.category===currentTaskTab) && t.active!==false && !(t.hiddenUsers && t.hiddenUsers[uid]));
  if(!entries.length){ box.innerHTML = '<div class="empty-state">No tasks in this category yet</div>'; return; }
  box.innerHTML = entries.map(([id,t],idx)=>renderTaskCard(id,t,idx)).join('');
  entries.forEach(([id,t])=>{ if(t.category==='visit') checkVisitPending(id); });
}
function renderTaskCard(id, t, idx){
  const done = taskDoneToday(id);
  let btn;
  if(t.category==='social' && socialPendingFor(id)) btn = socialButtonHtml(id, t);
  else if(done) btn = `<button class="task-btn done" disabled>Done ✓</button>`;
  else if(t.category==='join') btn = joinButtonHtml(id, t);
  else if(t.category==='refer') btn = referButtonHtml(id, t);
  else if(t.category==='watch') btn = watchButtonHtml(id, t);
  else if(t.category==='social') btn = socialButtonHtml(id, t);
  else btn = visitButtonHtml(id, t);
  const sub = t.category==='refer' ? (()=>{ const p=referProgress(id); return `<div class="task-sub">${p.count}/${p.required} ${p.type==='active'?'active ':''}referrals</div>`; })() : '';
  const desc = t.description ? `<div class="task-sub">${esc(t.description)}</div>` : '';
  const icon = t.image
    ? `<img src="${esc(t.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display='none'">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${taskIcons[t.category]||taskIcons.generic}</svg>`;
  return `
  <div class="task-card" data-task-id="${id}" style="animation-delay:${idx*0.06}s">
    <div class="task-icon">${icon}</div>
    <div class="task-body">
      <div class="task-name">${esc(t.name)}</div>
      <div class="task-reward">+${Number(t.reward||0)} CRTA</div>
      ${desc}
      ${sub}
    </div>
    ${btn}
  </div>`;
}

/* ---- SOCIAL (screenshot proof, admin reviewed) ---- */
function socialButtonHtml(id, t){
  if(socialPendingFor(id)) return `<button class="task-btn locked" disabled>Pending</button>`;
  if(t.link && taskFlow[id]!=='went') return `<button class="task-btn" onclick="startSocialTask('${id}')">Go</button>`;
  return `<button class="task-btn" onclick="openSocialSheet('${id}')">Submit</button>`;
}
function startSocialTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  openExternal(t.link);
  taskFlow[id] = 'went';
  updateTaskBtn(id, socialButtonHtml(id, t));
}
function resetSocialSheet(){
  socialImage = null;
  const up = document.getElementById('social-upload');
  up.classList.remove('has-img');
  document.getElementById('social-preview').removeAttribute('src');
  document.getElementById('social-file').value = '';
  document.getElementById('social-submit-btn').disabled = true;
}
function openSocialSheet(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id) || socialPendingFor(id)) return;
  socialTaskId = id;
  resetSocialSheet();
  document.getElementById('social-sheet-title').textContent = t.name || 'Submit proof';
  document.getElementById('social-sheet-desc').textContent = t.description || 'Complete the task and upload a screenshot as proof.';
  document.getElementById('sheet-social').classList.add('active');
}
function closeSocialSheet(){
  document.getElementById('sheet-social').classList.remove('active');
  socialTaskId = null;
}
function compressImage(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = ()=>{
      const img = new Image();
      img.onerror = reject;
      img.onload = ()=>{
        const r = Math.min(1, 1000/Math.max(img.width, img.height));
        const w = Math.round(img.width*r), h = Math.round(img.height*r);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0,0,w,h);
        cx.drawImage(img,0,0,w,h);
        let q = 0.72, out = c.toDataURL('image/jpeg', q);
        while(out.length > 350000 && q > 0.4){ q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function onSocialFile(input){
  const f = input.files && input.files[0];
  if(!f) return;
  if(!/^image\//.test(f.type)){ showToast('Please choose an image'); input.value = ''; return; }
  try{
    socialImage = await compressImage(f);
    document.getElementById('social-preview').src = socialImage;
    document.getElementById('social-upload').classList.add('has-img');
    document.getElementById('social-submit-btn').disabled = false;
  }catch(e){ showToast('Could not read that image'); }
}
async function submitSocial(){
  if(socialBusy || !socialImage || !socialTaskId) return;
  const id = socialTaskId, t = tasksCache[id];
  if(!t || socialPendingFor(id) || taskDoneToday(id)){ closeSocialSheet(); renderTasks(); return; }
  socialBusy = true;
  const btn = document.getElementById('social-submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';
  let reserved = false;
  try{
    if(taskQuantityActive(t)){
      const res = await db.ref('tasks/'+id).transaction(cur=>{
        if(!cur) return cur;
        const total = Number(cur.totalQuantity||0);
        if(total>0){
          if(Number(cur.usedQuantity||0) + Number(cur.reserved||0) >= total) return;
          cur.reserved = Number(cur.reserved||0)+1;
        }
        return cur;
      });
      if(!res.committed || !res.snapshot.exists()){ showToast('No slots left for this task'); closeSocialSheet(); renderTasks(); return; }
      reserved = true;
    }
    const key = db.ref('socialSubmissions/pending').push().key;
    const reward = Number(t.reward||0);
    const stamp = firebase.database.ServerValue.TIMESTAMP;
    const up = {};
    up['socialSubmissions/pending/'+key] = { uid, username: me.username||'', name: ((me.firstName||'')+' '+(me.lastName||'')).trim(), taskId:id, taskName:t.name||'', description:t.description||'', link:t.link||'', reward, dayKey:taskDayKey(), createdAt:stamp };
    up['socialProofs/'+key] = socialImage;
    up['userSocial/'+uid+'/pending/'+key] = { taskId:id, taskName:t.name||'', reward, createdAt:stamp };
    up['users/'+uid+'/txlog/'+key] = { type:'task', title:'Social task · '+(t.name||''), detail:t.description||'', amt:'+'+reward.toFixed(4)+' CRTA', time:stamp, status:'pending' };
    await db.ref().update(up);
    showToast('Submitted — waiting for review');
    closeSocialSheet();
  }catch(e){
    if(reserved) db.ref('tasks/'+id).transaction(cur=>{ if(!cur) return cur; cur.reserved = Math.max(0, Number(cur.reserved||0)-1); return cur; });
    showToast('Failed to submit, try again');
  }
  socialBusy = false;
  btn.textContent = 'Submit';
}

/* ---- JOIN (auto verify) ---- */
async function checkChannelMember(channelId){
  const token = String(settings.botToken||'').trim();
  if(!token || !channelId) return null;
  try{
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(channelId)}&user_id=${encodeURIComponent(uid)}`);
    const data = await res.json();
    if(!data.ok) return null;
    return ['creator','administrator','member','restricted'].includes(data.result.status);
  }catch(e){ return null; }
}
function joinButtonHtml(id, t){
  const f = taskFlow[id];
  if(f==='waiting') return `<button class="task-btn locked" disabled>Go</button>`;
  if(f==='checking') return `<button class="task-btn locked" disabled>Verifying...</button>`;
  if(f==='ready') return `<button class="task-btn" onclick="claimJoinTask('${id}')">Claim</button>`;
  if(f==='notjoined') return `<button class="task-btn" onclick="verifyJoinTask('${id}')">Not Joined — Retry</button>`;
  if(f==='checkfailed') return `<button class="task-btn" onclick="verifyJoinTask('${id}')">Couldn't Verify — Retry</button>`;
  return `<button class="task-btn" onclick="startJoinTask('${id}')">Go</button>`;
}
function startJoinTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  if(t.link) openExternal(t.link);
  taskFlow[id] = 'waiting';
  updateTaskBtn(id, joinButtonHtml(id,t));
  setTimeout(()=>verifyJoinTask(id), 5000);
}
async function verifyJoinTask(id){
  const t = tasksCache[id];
  if(!t) return;
  taskFlow[id] = 'checking';
  updateTaskBtn(id, joinButtonHtml(id,t));
  const isMember = await checkChannelMember(t.channelId);
  taskFlow[id] = isMember===true ? 'ready' : isMember===false ? 'notjoined' : 'checkfailed';
  updateTaskBtn(id, joinButtonHtml(id,t));
}
async function claimJoinTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  delete taskFlow[id];
  await creditTask(t, id);
}

/* ---- REFER (same batching model across multiple refer tasks, kept separate
   per referral type — "normal" tasks batch against all joined referrals,
   "active" tasks batch only against referrals whose status is now active) ---- */
function referTasksSorted(type){
  return Object.entries(tasksCache).filter(([,t])=>t.category==='refer' && t.active!==false && (t.referType||'normal')===type)
    .sort((a,b)=>(Number(a[1].requiredReferrals)||1)-(Number(b[1].requiredReferrals)||1));
}
function referProgress(id){
  const t = tasksCache[id] || {};
  const type = t.referType==='active' ? 'active' : 'normal';
  const required = Number(t.requiredReferrals||1);
  const cursor = Number((me && me.taskReferCursor && me.taskReferCursor[id]) || 0);
  const list = Object.values((me && me.referrals) || {})
    .filter(r => type==='active' ? r.status==='active' : true)
    .filter(r => Number(r.joinedAt||0) > cursor)
    .sort((a,b)=>Number(a.joinedAt||0)-Number(b.joinedAt||0));
  const sorted = referTasksSorted(type);
  const idx = sorted.findIndex(([tid])=>tid===id);
  let offset = 0;
  for(let i=0;i<idx;i++) offset += Math.max(1, Number(sorted[i][1].requiredReferrals)||1);
  const count = Math.max(0, Math.min(list.length - offset, required));
  return { count, required, met: count >= required, type };
}
function referButtonHtml(id){
  if(taskFlow[id]==='claiming') return `<button class="task-btn locked" disabled>Claiming...</button>`;
  const p = referProgress(id);
  if(!p.met) return `<button class="task-btn" onclick="shareOnTelegram()">Invite</button>`;
  return `<button class="task-btn" onclick="claimReferTask('${id}')">Claim</button>`;
}
async function claimReferTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  const p = referProgress(id);
  if(!p.met){ showToast('You need '+(p.required-p.count)+' more '+(p.type==='active'?'active ':'')+'referral(s)'); return; }
  taskFlow[id] = 'claiming';
  updateTaskBtn(id, referButtonHtml(id));
  await db.ref('users/'+uid+'/taskReferCursor/'+id).set(Date.now());
  delete taskFlow[id];
  await creditTask(t, id);
}

/* ---- WATCH (active ad network, then a live real-time wait timer, then an
   optional real-time break/cooldown before it can be redone) ---- */
function watchButtonHtml(id, t){
  const f = taskFlow[id];
  if(f==='watching') return `<button class="task-btn locked" disabled>Loading Ad...</button>`;
  const breakRemain = taskBreakRemain(id);
  if(breakRemain>0) return `<button class="task-btn locked" disabled>Available in ${breakRemain}s</button>`;
  const wait = taskWaitInfo(id);
  if(wait){
    if(!wait.ready) return `<button class="task-btn locked" disabled>Wait ${wait.remain}s</button>`;
    return `<button class="task-btn" onclick="claimWatchTask('${id}')">Claim</button>`;
  }
  return `<button class="task-btn" onclick="startWatchTask('${id}')">Watch Ad</button>`;
}
async function startWatchTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id) || taskBreakRemain(id)>0) return;
  taskFlow[id] = 'watching';
  updateTaskBtn(id, watchButtonHtml(id,t));
  try{ await showActiveRewardedAd(); }
  catch(e){ delete taskFlow[id]; updateTaskBtn(id, watchButtonHtml(id,t)); showToast('Ad failed to load, try again'); return; }
  delete taskFlow[id];
  // Ad closed ("x" out) — start the live, real-time wait before Claim unlocks.
  await db.ref('users/'+uid+'/taskTimers/'+id+'_wait').set(Date.now() + Number(t.watchSeconds||15)*1000);
  updateTaskBtn(id, watchButtonHtml(id,t));
}
async function claimWatchTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  const wait = taskWaitInfo(id);
  if(!wait || !wait.ready) return;
  delete taskFlow[id];
  await db.ref('users/'+uid+'/taskTimers/'+id+'_wait').remove();
  await creditTask(t, id);
}

/* ---- VISIT (link opens, reward only if the user stays away long enough) ---- */
function visitStorageKey(id){ return 'cryptena_visit_'+uid+'_'+id; }
let visitWatchersArmed = {};
function armVisitWatcher(id){
  if(visitWatchersArmed[id]) return;
  visitWatchersArmed[id] = true;
  const handler = ()=>{ if(document.visibilityState==='visible') checkVisitReturn(id); };
  document.addEventListener('visibilitychange', handler);
  window.addEventListener('focus', handler);
}
function visitButtonHtml(id, t){
  const breakRemain = taskBreakRemain(id);
  if(breakRemain>0) return `<button class="task-btn locked" disabled>Available in ${breakRemain}s</button>`;
  const f = taskFlow[id];
  if(f==='pending') return `<button class="task-btn locked" disabled>Waiting...</button>`;
  if(f==='ready') return `<button class="task-btn" onclick="claimVisitTask('${id}')">Claim</button>`;
  return `<button class="task-btn" onclick="startVisitTask('${id}')">Go</button>`;
}
function startVisitTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id) || taskBreakRemain(id)>0) return;
  localStorage.setItem(visitStorageKey(id), JSON.stringify({ clickedAt: Date.now() }));
  taskFlow[id] = 'pending';
  updateTaskBtn(id, visitButtonHtml(id,t));
  if(t.link) openExternal(t.link);
  armVisitWatcher(id);
}
function checkVisitReturn(id){
  const raw = localStorage.getItem(visitStorageKey(id));
  if(!raw) return;
  const t = tasksCache[id];
  if(!t) return;
  const rec = JSON.parse(raw);
  const elapsed = (Date.now() - rec.clickedAt) / 1000;
  localStorage.removeItem(visitStorageKey(id));
  if(elapsed < Number(t.visitSeconds||15)){
    delete taskFlow[id];
    updateTaskBtn(id, visitButtonHtml(id,t));
    showToast('You came back too fast — task not counted, try again');
    return;
  }
  taskFlow[id] = 'ready';
  updateTaskBtn(id, visitButtonHtml(id,t));
}
function checkVisitPending(id){
  const raw = localStorage.getItem(visitStorageKey(id));
  if(!raw) return;
  taskFlow[id] = 'pending';
  armVisitWatcher(id);
  checkVisitReturn(id);
}
async function claimVisitTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  delete taskFlow[id];
  await creditTask(t, id);
}

/* ---------------- SWAP ----------------
   Deposit balance -> CRTA : the user keeps only the active badge's "Deposit swap %"
                             (100 deposit at 50% = 50 CRTA, the other 50 is deducted).
   CRTA -> USD             : at the admin's rate (settings.swapRate = USD per 1 CRTA).
   Deposit balance -> USD  : NOT possible. USD can never be swapped back.
   Deposit balance and CRTA stay separate, neither is withdrawable — only USD is. */
let swapMode = 'deposit';          // 'deposit' = Deposit -> CRTA   |   'crpt' = CRTA -> USD
function round6(n){ return Math.round(n*1e6)/1e6; }
function swapQuote(from){
  if(swapMode === 'deposit'){
    const pct = depositSwapPct();
    const to = round6(from * pct / 100);
    return { to, cut: round6(from - to), pct };
  }
  return { to: round6(from * swapRate()), cut: 0, pct: 100 };
}
function swapSourceBalance(){
  if(!me) return 0;
  return swapMode === 'deposit' ? (me.depositBalance||0) : (me.crpt||0);
}
function setSwapMode(mode){
  swapMode = mode === 'crpt' ? 'crpt' : 'deposit';
  document.getElementById('swap-amount').value = '';
  refreshSwapUI();
}
function setMaxSwapAmount(){
  const bal = swapSourceBalance();
  document.getElementById('swap-amount').value = bal>0 ? (Math.floor(bal*10000)/10000) : '';
  updateSwapEstimate();
}
function updateSwapEstimate(){
  const from = parseFloat(document.getElementById('swap-amount').value) || 0;
  const out = document.getElementById('swap-usd-output');
  const detail = document.getElementById('swap-detail');
  out.value = from > 0 ? swapQuote(from).to.toFixed(4) : '';
  if(swapMode === 'deposit' && from > 0){
    const q = swapQuote(from);
    detail.style.display = '';
    detail.innerHTML = 'You keep <b>' + q.pct + '%</b> = ' + q.to.toFixed(4) + ' CRTA · <b>' + q.cut.toFixed(4) + '</b> deducted';
  } else {
    detail.style.display = 'none';
  }
}
function refreshSwapUI(){
  if(!me) return;
  const dep = swapMode === 'deposit';
  document.getElementById('swap-mode-deposit').classList.toggle('active', dep);
  document.getElementById('swap-mode-crpt').classList.toggle('active', !dep);
  document.getElementById('swap-from-label').textContent = dep ? 'Deposit balance' : 'Earning balance';
  document.getElementById('swap-to-label').textContent = dep ? 'Earning balance' : 'USD balance';
  document.getElementById('swap-from-tag').textContent = 'CRTA';
  const toTag = document.getElementById('swap-to-tag');
  toTag.textContent = dep ? 'CRTA' : 'USD';
  toTag.classList.toggle('usd', !dep);
  const bal = swapSourceBalance();
  document.getElementById('swap-src-balance').textContent = bal.toFixed(4) + ' CRTA';

  const btn = document.getElementById('swap-submit-btn');
  const note = document.getElementById('swap-note');
  if(!btn || !note) return;
  const badge = myBadge();
  let blocked = '';
  if(dep){
    const pct = depositSwapPct();
    note.textContent = pct > 0
      ? 'Your level (' + (badge.name||'') + ') converts ' + pct + '% of the deposit balance to CRTA. The rest is deducted.'
      : 'Your level (' + (badge.name||'') + ') has 0% deposit swap. Unlock a level with a swap % to convert deposit balance.';
    if(pct <= 0) blocked = 'Deposit swap not available';
  } else {
    const r = swapRate();
    note.textContent = '1 CRTA = $' + r + ' USD · USD cannot be swapped back';
    if(r <= 0) blocked = 'Swap rate not set';
  }
  if(!blocked && bal <= 0) blocked = 'No balance to swap';
  btn.disabled = !!blocked;
  setBtnLabel(btn, blocked || (dep ? 'Swap to CRTA' : 'Swap to USD'));
  updateSwapEstimate();
}
function doUnifiedSwap(){
  if(!me) return;
  const from = parseFloat(document.getElementById('swap-amount').value);
  if(!from || from <= 0){ showToast('Enter a valid amount'); return; }
  if(from > swapSourceBalance()){ showToast(swapMode==='deposit' ? 'Insufficient deposit balance' : 'Insufficient CRTA balance'); return; }
  const q = swapQuote(from);
  let updates, hist, txTitle, txUnit, okMsg;
  if(swapMode === 'deposit'){
    if(q.pct <= 0){ showToast('Your level has 0% deposit swap'); return; }
    if(q.to <= 0){ showToast('Amount is too small'); return; }
    updates = {
      ['users/'+uid+'/depositBalance']: SERVER_INC(-from),
      ['users/'+uid+'/crpt']: SERVER_INC(q.to)
    };
    hist = {from:'Deposit', to:'CRTA', amtFrom:from, amtTo:q.to, keptPercent:q.pct, deducted:q.cut};
    txTitle = 'Swapped '+from.toFixed(2)+' deposit balance → CRTA ('+q.pct+'% kept)';
    txUnit = 'CRTA';
    okMsg = 'Swapped to ' + q.to.toFixed(4) + ' CRTA';
  } else {
    if(swapRate() <= 0){ showToast('Swap rate is not set yet'); return; }
    updates = {
      ['users/'+uid+'/crpt']: SERVER_INC(-from),
      ['users/'+uid+'/usdBalance']: SERVER_INC(q.to)
    };
    hist = {from:'CRTA', to:'USD', amtFrom:from, amtTo:q.to, rate:swapRate()};
    txTitle = 'Swapped '+from.toFixed(2)+' CRTA → USD';
    txUnit = 'USD';
    okMsg = 'Swapped to $' + q.to.toFixed(4) + ' USD';
  }
  db.ref().update(updates).then(()=>{
    hist.time = firebase.database.ServerValue.TIMESTAMP;
    db.ref('users/'+uid+'/swapHistory').push(hist);
    pushTx('swap', txTitle, q.to, txUnit);
    showToast(okMsg);
    document.getElementById('swap-amount').value = '';
    updateSwapEstimate();
  }).catch(()=>{ showToast('Something went wrong. Please try again.'); });
}
function formatTimeAgo(ts){
  if(!ts) return '';
  const diffMs = Date.now()-ts;
  const mins = Math.floor(diffMs/60000);
  if(mins < 1) return 'Just now';
  if(mins < 60) return mins+'m ago';
  const hrs = Math.floor(mins/60);
  if(hrs < 24) return hrs+'h ago';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ', ' + d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
}
function renderSwapHistory(){
  const box = document.getElementById('swap-history-list');
  if(!box) return;
  const list = me.swapHistory ? Object.values(me.swapHistory).sort((a,b)=>(b.time||0)-(a.time||0)) : [];
  if(!list.length){ box.innerHTML = '<div class="swap-history-empty">No swaps yet</div>'; return; }
  box.innerHTML = list.map(h=>`
    <div class="swap-history-row">
      <div class="swh-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M17 3l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>
      <div class="swh-info">
        <div class="swh-pair">${esc(String(h.from).replace('CRPT','CRTA'))}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          ${esc(String(h.to).replace('CRPT','CRTA'))}</div>
        <div class="swh-time">${formatTimeAgo(h.time)}</div>
      </div>
      <div class="swh-right">
        <div class="swh-out">-${Number(h.amtFrom).toFixed(4)}</div>
        <div class="swh-in">+${Number(h.amtTo).toFixed(4)}</div>
      </div>
    </div>`).join('');
}

/* ---------------- TRANSACTIONS ---------------- */
function switchTxTab(tab){
  currentTxTab = tab;
  document.querySelectorAll('#page-transactions .task-tab').forEach(t=>t.classList.toggle('active', t.dataset.txTab===tab));
  renderTransactions();
}
function txIconSvg(type){
  if(type==='task') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
  if(type==='mining') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
  if(type==='swap') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M17 3l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
  if(type==='deposit') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  if(type==='withdraw') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
}
function renderTransactions(){
  const box = document.getElementById('tx-list');
  if(!box || !me) return;
  let list = me.txlog ? Object.values(me.txlog) : [];
  list.sort((a,b)=>(b.time||0)-(a.time||0));
  if(currentTxTab!=='all') list = list.filter(t=>t.type===currentTxTab);
  if(!list.length){ box.innerHTML = '<div class="swap-history-empty">No transactions</div>'; return; }
  box.innerHTML = list.slice(0,100).map(t=>`
    <div class="swap-history-row${t.status?' tx-row-'+esc(t.status):''}">
      <div class="tx-icon tx-${esc(t.type)}">${txIconSvg(t.type)}</div>
      <div class="swh-info">
        <div class="swh-pair" style="text-transform:none;">${esc(t.title)}</div>
        ${t.detail ? `<div class="swh-time">${esc(t.detail)}</div>` : ''}
        <div class="swh-time">${formatTimeAgo(t.time)}</div>
      </div>
      <div class="swh-right"><div class="swh-in">${esc(String(t.amt).replace('CRPT','CRTA'))}</div>${t.status ? `<span class="tx-status ${esc(t.status)}">${esc(t.status)}</span>` : ''}</div>
    </div>`).join('');
}

/* ---------------- SHARED HELPERS (deposit / withdraw) ---------------- */
const lockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
function fmtNum(n){ return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:4}); }
function fmtAmt(n){ return Number(n||0).toFixed(4); }
// kind: 'deposit' | 'withdraw' — when the user's active badge sets a fee % for that kind (>0), it overrides the method's own fee
function methodFeePct(m, kind){
  const badge = myBadge();
  if(kind==='withdraw' && Number(badge.withdrawFeePercent) > 0) return Number(badge.withdrawFeePercent);
  if(kind==='deposit' && Number(badge.depositFeePercent) > 0) return Number(badge.depositFeePercent);
  const f = Number(m && m.feePercent); return isFinite(f) && f>0 ? f : 0;
}
function calcFee(m, amt){
  const pct = methodFeePct(m, 'withdraw');
  const fee = amt>0 ? Math.round(amt*pct/100*1e6)/1e6 : 0;
  return { pct, fee, net: Math.max(0, Math.round((amt-fee)*1e6)/1e6) };
}
function methodMin(m, kind){
  return Number(m && m.min) || 0;
}
function limitText(m, kind){
  const parts = [];
  const mn = methodMin(m, kind);
  if(mn > 0) parts.push('Min '+fmtNum(mn));
  if(m.max > 0) parts.push('Max '+fmtNum(m.max));
  const unit = kind==='withdraw' ? 'USD' : 'CRTA';
  return parts.length ? parts.join(' · ')+' '+unit : 'No limit';
}
function copyText(t, msg, onOk){
  const done = ()=>{ showToast(msg || 'Copied!'); if(onOk) onOk(); };
  const legacy = ()=>{
    let ok = false;
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly','');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try{ ta.setSelectionRange(0, t.length); }catch(e){}
    try{ ok = document.execCommand('copy'); }catch(e){}
    ta.remove();
    if(ok) done(); else showToast('Copy failed. Please copy manually.');
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(done).catch(legacy);
  } else legacy();
}

/* =========================================================================
   DEPOSIT  (full-screen page)
   Flow: pick method -> pay-to details (address / QR / note) -> amount ->
         transaction ID proof -> confirm.
   The user receives the full CRTA amount; the method's fee % is added on top
   of what they have to send:  send = amount x rate x (1 + fee%)
   ========================================================================= */
let selectedDepositMethod = null;
let depositSubmitting = false;
let depTxidTouched = false;

function depRate(m){ const v = Number(m && m.rate); return isFinite(v) && v > 0 ? v : 1; }
function depCurrency(m){ return String((m && (m.currency || m.name)) || 'COIN').trim() || 'COIN'; }
function coinFmt(n){ return Number(n||0).toFixed(8).replace(/\.?0+$/, ''); }
function depPayable(amt, m){
  return Number((amt * depRate(m) * (1 + methodFeePct(m, 'deposit')/100)).toFixed(8));
}
function enabledDepositMethods(){
  return Object.keys(depositMethods).filter(id=> depositMethods[id] && depositMethods[id].enabled !== false)
    .map(id=> Object.assign({id}, depositMethods[id]));
}
function depEl(id){ return document.getElementById(id); }
function hideDepositSteps(){
  ['deposit-method-details','deposit-amount-section','deposit-txid-section'].forEach(id=>{ depEl(id).style.display = 'none'; });
}

function openDeposit(){
  if(!me) return;
  selectedDepositMethod = null;
  depTxidTouched = false;
  depEl('deposit-amount').value = '';
  depEl('deposit-txid').value = '';
  hideDepositSteps();
  renderDepositMethods();
  validateDepositForm();
  goTo('deposit');
}

function renderDepositMethods(){
  const wrap = depEl('deposit-methods');
  if(!wrap) return;
  const methods = enabledDepositMethods();
  if(!methods.length){
    wrap.innerHTML = '<div class="empty-state">No deposit methods yet.<br>Please check back later.</div>';
    selectedDepositMethod = null;
    hideDepositSteps();
    validateDepositForm();
    return;
  }
  wrap.innerHTML = methods.map(m=>`
    <div class="deposit-method${selectedDepositMethod && selectedDepositMethod.id===m.id ? ' selected' : ''}" data-id="${esc(m.id)}" onclick="selectDepositMethod(this.dataset.id)">
      ${logoBox(m.logoUrl, (m.name||'?').trim().charAt(0).toUpperCase(), 'dm-logo')}
      <span class="dm-name">${esc(m.name||'Method')}</span>
    </div>`).join('');
  if(selectedDepositMethod){
    const still = methods.find(m=>m.id === selectedDepositMethod.id);
    if(still){ selectedDepositMethod = still; showDepositMethodDetail(still); }
    else { selectedDepositMethod = null; hideDepositSteps(); }
  }
  validateDepositForm();
}

function selectDepositMethod(id){
  const m = enabledDepositMethods().find(x=>x.id === id);
  if(!m) return;
  selectedDepositMethod = m;
  document.querySelectorAll('#deposit-methods .deposit-method').forEach(el=> el.classList.toggle('selected', el.dataset.id === id));
  showDepositMethodDetail(m);
  depEl('deposit-amount-section').style.display = 'block';
  depEl('deposit-txid-section').style.display = 'block';
  onDepositAmountChange();
}

function showDepositMethodDetail(m){
  depEl('deposit-method-details').style.display = 'block';
  depEl('deposit-method-detail-label').textContent = 'Send payment to (' + (m.name||'') + ')';
  depEl('deposit-method-detail-value').textContent = m.wallet || m.note || '—';

  const qrBox = depEl('deposit-method-qr');
  if(m.qrUrl){
    qrBox.style.display = 'block';
    qrBox.innerHTML = `<img id="deposit-qr-image" src="${esc(m.qrUrl)}" alt="QR" referrerpolicy="no-referrer" loading="lazy" onclick="openQrLightbox()" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'qr-fallback',textContent:'QR unavailable'}));">`;
  } else { qrBox.style.display = 'none'; qrBox.innerHTML = ''; }

  depEl('deposit-limit-text').textContent =
    'Rate: 1 CRTA = ' + coinFmt(depRate(m)) + ' ' + depCurrency(m) + ' · ' + limitText(m);

  const noteBox = depEl('deposit-method-note');
  if(m.note && m.wallet){ noteBox.style.display = 'block'; noteBox.textContent = m.note; }
  else { noteBox.style.display = 'none'; noteBox.textContent = ''; }
}

function copyDepositAddress(){
  if(!selectedDepositMethod) return;
  const text = selectedDepositMethod.wallet || selectedDepositMethod.note || '';
  if(!text){ showToast('No address to copy'); return; }
  copyText(text, 'Address copied!');
}

// tap the QR to see it full size
function openQrLightbox(){
  const img = depEl('deposit-qr-image');
  if(!img || !img.src) return;
  let box = document.getElementById('qr-lightbox');
  if(!box){
    box = document.createElement('div');
    box.id = 'qr-lightbox';
    box.className = 'qr-lightbox';
    box.innerHTML = '<button class="qr-close" aria-label="Close">✕</button><img id="qr-lightbox-img" alt="QR" referrerpolicy="no-referrer">';
    box.addEventListener('click', ()=> box.classList.remove('show'));
    document.body.appendChild(box);
  }
  document.getElementById('qr-lightbox-img').src = img.src;
  box.classList.add('show');
}

function setDepositAmount(v){
  depEl('deposit-amount').value = v;
  onDepositAmountChange();
}
function onDepositAmountChange(){
  validateDepositForm();
  renderDepositBreakdown();
}

function renderDepositBreakdown(){
  const box = depEl('deposit-breakdown');
  const amt = parseFloat(depEl('deposit-amount').value);
  if(!selectedDepositMethod || !amt || amt <= 0){ box.style.display = 'none'; return; }
  const m = selectedDepositMethod, unit = depCurrency(m), pct = methodFeePct(m, 'deposit');
  const base = amt * depRate(m);
  const feeCoin = base * pct / 100;
  box.style.display = 'block';
  box.innerHTML =
    'Rate: 1 CRTA = ' + coinFmt(depRate(m)) + ' ' + esc(unit) + '<br>' +
    'Deposit fee (' + pct + '%): ' + coinFmt(feeCoin) + ' ' + esc(unit) + '<br>' +
    'You must send: <strong>' + coinFmt(depPayable(amt, m)) + ' ' + esc(unit) + '</strong><br>' +
    'You will receive: <strong>' + fmtNum(amt) + ' CRTA</strong>';
}

function validateDepositForm(){
  const errEl = depEl('deposit-amount-error');
  const txErr = depEl('deposit-txid-error');
  const btn = depEl('deposit-submit-btn');
  errEl.classList.remove('show');
  txErr.classList.remove('show');
  btn.disabled = true;
  if(!selectedDepositMethod) return false;

  const m = selectedDepositMethod;
  const amt = parseFloat(depEl('deposit-amount').value);
  const txid = depEl('deposit-txid').value.trim();
  if(!amt || amt <= 0) return false;
  if(m.min > 0 && amt < m.min){ errEl.textContent = 'Minimum deposit is ' + fmtNum(m.min) + ' CRTA'; errEl.classList.add('show'); return false; }
  if(m.max > 0 && amt > m.max){ errEl.textContent = 'Maximum deposit is ' + fmtNum(m.max) + ' CRTA'; errEl.classList.add('show'); return false; }
  if(!txid){
    if(depTxidTouched){ txErr.textContent = 'Transaction ID / proof is required'; txErr.classList.add('show'); }
    return false;
  }
  btn.disabled = depositSubmitting;
  return true;
}

function submitDeposit(){
  if(!me || depositSubmitting) return;
  const m = selectedDepositMethod;
  const amt = parseFloat(depEl('deposit-amount').value);
  const txid = depEl('deposit-txid').value.trim();
  if(!m){ showToast('Select a deposit method'); return; }
  if(!amt || amt <= 0){ showToast('Enter a valid amount'); return; }
  if(m.min > 0 && amt < m.min){ showToast('Minimum deposit is ' + fmtNum(m.min) + ' CRTA'); return; }
  if(m.max > 0 && amt > m.max){ showToast('Maximum deposit is ' + fmtNum(m.max) + ' CRTA'); return; }
  if(!txid){ depTxidTouched = true; validateDepositForm(); showToast('Transaction ID / proof is required'); return; }

  const unit = depCurrency(m);
  const payAmount = depPayable(amt, m);
  const record = {
    uid, username: me.username || me.firstName || '',
    methodId: m.id, methodName: m.name || '',
    amount: amt,                        // CRTA credited to the deposit balance when accepted (not withdrawable directly — must be swapped to USD first)
    rate: depRate(m),                   // rate at the time of the request
    paymentCurrency: unit,
    feePercent: methodFeePct(m, 'deposit'),
    payAmount,                          // what the user has to send, in paymentCurrency
    txid,
    status: 'pending',
    createdAt: firebase.database.ServerValue.TIMESTAMP
  };

  depositSubmitting = true;
  depEl('deposit-submit-btn').disabled = true;
  setBtnLabel('deposit-submit-btn', 'Processing…');
  const depKey = db.ref('deposits').push().key;
  db.ref().update({
    ['deposits/'+depKey]: record,
    ['users/'+uid+'/txlog/'+depKey]: { type:'deposit', title:'Deposit · '+(m.name||''), detail:'TxID '+txid, amt:'+'+Number(amt).toFixed(4)+' CRTA', time: firebase.database.ServerValue.TIMESTAMP, status:'pending' }
  }).then(()=>{
    showToast('Deposit request of ' + fmtNum(amt) + ' CRTA submitted. Send ' + coinFmt(payAmount) + ' ' + unit + ' to complete.');
    depEl('deposit-amount').value = '';
    depEl('deposit-txid').value = '';
    goBack();
  }).catch(()=>{
    showToast('Failed to submit deposit request');
  }).then(()=>{
    depositSubmitting = false;
    setBtnLabel('deposit-submit-btn', 'Confirm Deposit');
    validateDepositForm();
  });
}

/* =========================================================================
   WITHDRAW  (full-screen page)
   ========================================================================= */
let selectedWithdrawId = null;
let withdrawBusy = false;

function withdrawMethodList(){
  const wallets = (me && me.wallets) || {};
  return Object.entries(withdrawMethods).filter(([id,m])=> m && m.enabled !== false && wallets[id]);
}
// unmet requirements of a withdraw method
function methodLockReasons(m){
  if(!me) return [];
  const r = [];
  const a = m.requiredActiveReferral||0, n = m.requiredNormalReferral||0,
        d = m.requiredDepositBalance||0, c = m.requiredMinUsd||0;
  if(a > (me.referralsActive||0)) r.push(a+' active referral'+(a>1?'s':''));
  if(n > (me.referralsNormal||0)) r.push(n+' referral'+(n>1?'s':''));
  if(d > (me.depositBalance||0))  r.push(fmtNum(d)+' CRTA deposit balance');
  if(c > (me.usdBalance||0))      r.push('$'+fmtNum(c)+' USD balance');
  return r;
}

function renderWithdrawPage(){
  const list = document.getElementById('wd-method-list');
  if(!list || !me) return;
  const wallets = me.wallets || {};
  const hasAnyWallet = hasWallet();
  const prompt = document.getElementById('wd-connect-prompt');
  const formBody = document.getElementById('wd-form-body');
  const pill = document.getElementById('wd-wallet-pill');
  const amountSec = document.getElementById('wd-amount-section');

  document.getElementById('wd-balance').textContent = '$'+fmtAmt(me.usdBalance)+' USD';

  if(!hasAnyWallet){
    if(prompt) prompt.style.display = '';
    if(formBody) formBody.style.display = 'none';
    if(pill) pill.style.display = 'none';
    list.innerHTML = '';
    selectedWithdrawId = null;
    updateWithdrawSummary();
    return;
  }
  if(prompt) prompt.style.display = 'none';
  if(formBody) formBody.style.display = '';

  const entries = withdrawMethodList();
  // a method must be picked by the user (and must be unlocked) before the amount box appears
  const sel = selectedWithdrawId && withdrawMethods[selectedWithdrawId];
  if(!sel || methodLockReasons(sel).length || !wallets[selectedWithdrawId]) selectedWithdrawId = null;

  list.innerHTML = entries.length ? entries.map(([id,m])=>{
    const reasons = methodLockReasons(m);
    const locked = reasons.length > 0;
    const pct = methodFeePct(m);
    return `
    <div class="method-card${id===selectedWithdrawId?' selected':''}${locked?' locked':''}" data-id="${esc(id)}" onclick="selectWithdrawMethod(this.dataset.id)">
      ${logoBox(m.logoUrl, (m.name||'?').trim().charAt(0).toUpperCase(), 'mc-logo')}
      <div class="mc-info">
        <div class="mc-name">${esc(m.name||'Method')}</div>
        <div class="mc-meta">${esc(limitText(m,'withdraw'))}</div>
        ${locked ? `<div class="mc-lock">Requires ${esc(reasons.join(', '))}</div>` : ''}
      </div>
      <div class="mc-side">
        <span class="fee-tag">${pct>0 ? 'Fee '+pct+'%' : 'No fee'}</span>
        ${locked ? `<span class="lock-ic">${lockSvg}</span>` : '<span class="radio"></span>'}
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No connected withdraw method available. Connect one from your profile.</div>';

  // masked wallet of the selected method, shown on the balance card (top-left)
  if(pill){
    if(selectedWithdrawId){
      document.getElementById('wd-wallet-mask').textContent = maskAddr(wallets[selectedWithdrawId]);
      pill.style.display = '';
    } else pill.style.display = 'none';
  }
  if(amountSec) amountSec.style.display = selectedWithdrawId ? '' : 'none';
  updateWithdrawSummary();
}

function selectWithdrawMethod(id){
  const m = withdrawMethods[id];
  if(!m) return;
  const reasons = methodLockReasons(m);
  if(reasons.length){ showToast('Requires '+reasons.join(', ')); return; }
  selectedWithdrawId = id;
  renderWithdrawPage();
}

function updateWithdrawSummary(){
  const input = document.getElementById('wd-amount');
  const hint = document.getElementById('wd-hint');
  const box = document.getElementById('wd-summary');
  const cta = document.getElementById('wd-cta');
  if(!input || !hint || !box || !cta) return;
  const m = withdrawMethods[selectedWithdrawId];
  cta.disabled = !m || withdrawBusy;
  if(!m){ hint.textContent = ''; box.innerHTML = ''; return; }
  const pct = methodFeePct(m);
  hint.textContent = limitText(m,'withdraw') + ' · ' + (pct>0 ? 'Fee '+pct+'%' : 'No fee');
  const amt = parseFloat(input.value) || 0;
  if(amt <= 0){ box.innerHTML = ''; return; }
  const f = calcFee(m, amt);
  box.innerHTML = `
    <div class="summary-card">
      <div class="sum-row"><span>Amount</span><b>$${fmtAmt(amt)} USD</b></div>
      <div class="sum-row"><span>Fee${pct>0 ? ' ('+pct+'%)' : ''}</span><b>${f.fee>0 ? '-' : ''}$${fmtAmt(f.fee)} USD</b></div>
      <div class="sum-row total"><span>You will receive</span><b>$${fmtAmt(f.net)} USD</b></div>
    </div>`;
}

function setMaxWithdraw(){
  if(!me) return;
  const m = withdrawMethods[selectedWithdrawId];
  let max = me.usdBalance || 0;
  if(m && m.max > 0) max = Math.min(max, m.max);
  document.getElementById('wd-amount').value = max > 0 ? (Math.floor(max*10000)/10000) : '';
  updateWithdrawSummary();
}

function openWithdraw(){
  if(!me) return;
  document.getElementById('wd-amount').value = '';
  selectedWithdrawId = null;
  renderWithdrawPage();
  goTo('withdraw');
}

function setWithdrawBusy(busy){
  withdrawBusy = busy;
  const cta = document.getElementById('wd-cta');
  cta.disabled = busy || !withdrawMethods[selectedWithdrawId];
  setBtnLabel(cta, busy ? 'Processing…' : 'Request withdrawal');
}

function submitWithdraw(){
  if(!me || withdrawBusy) return;
  const id = selectedWithdrawId;
  const m = withdrawMethods[id];
  if(!m){ showToast('Select a method'); return; }
  const input = document.getElementById('wd-amount');
  const amt = parseFloat(input.value);
  if(!amt || amt <= 0){ showToast('Enter a valid amount'); return; }
  const wMin = methodMin(m, 'withdraw');
  if(wMin > 0 && amt < wMin){ showToast('Minimum amount is $'+fmtNum(wMin)+' USD'); return; }
  if(m.max > 0 && amt > m.max){ showToast('Maximum amount is $'+fmtNum(m.max)+' USD'); return; }
  const f = calcFee(m, amt);
  if(f.net <= 0){ showToast('Amount is too small after fee'); return; }
  if(methodLockReasons(m).length){ showToast('You do not meet the requirements for this method'); return; }
  const walletAddr = (me.wallets && me.wallets[id]) || '';
  if(!walletAddr){ showToast('Connect a wallet for this method before withdrawing'); openWallet(); return; }
  if(amt > (me.usdBalance||0)){ showToast('Insufficient USD balance'); return; }

  const req = {
    uid, username: me.username || me.firstName || '',
    methodId: id, methodName: m.name || '',
    amount: amt, feePercent: f.pct, fee: f.fee, netAmount: f.net,
    wallet: walletAddr,
    status: 'pending', createdAt: firebase.database.ServerValue.TIMESTAMP
  };
  setWithdrawBusy(true);
  const key = db.ref('withdraws').push().key;
  // one atomic write: create the request + hold the amount from the USD earning balance
  db.ref().update({
    ['withdraws/'+key]: req,
    ['users/'+uid+'/usdBalance']: SERVER_INC(-amt),
    ['users/'+uid+'/totalWithdraw']: SERVER_INC(amt),
    ['users/'+uid+'/txlog/'+key]: { type:'withdraw', title:'Withdraw · '+(m.name||''), detail:'Payout $'+Number(f.net).toFixed(2)+' USD', amt:'-'+Number(amt).toFixed(4)+' USD', time: firebase.database.ServerValue.TIMESTAMP, status:'pending' }
  }).then(()=>{
    showToast('Withdrawal request submitted!');
    input.value = '';
    goBack();
  }).catch(()=>{
    showToast('Something went wrong. Please try again.');
  }).then(()=>{
    setWithdrawBusy(false);
    updateWithdrawSummary();
  });
}

/* ---------------- NOTIFICATIONS ---------------- */
function listenNotifications(){
  db.ref('notifications').on('value', s=>{
    const all = s.val() || {};
    const now = Date.now();
    const toRemove = [];
    const relevant = {};
    Object.entries(all).forEach(([id,n])=>{
      if(!n.permanent && n.expiresAt && n.expiresAt < now){ toRemove.push(id); return; }
      if(n.target === 'all' || n.target === uid) relevant[id] = n;
    });
    toRemove.forEach(id=> db.ref('notifications/'+id).remove().catch(()=>{}) );
    notifCache = relevant;
    const seen = (me && me.seenNotifs) || {};
    const unreadCount = Object.keys(relevant).filter(id=>!seen[id]).length;
    const dot = document.getElementById('notif-dot');
    if(dot) dot.style.display = unreadCount>0 ? 'block' : 'none';
    renderNotifPanel();
  });
}
function renderNotifPanel(){
  const box = document.getElementById('notif-list');
  if(!box) return;
  const list = Object.entries(notifCache).map(([id,n])=>Object.assign({id},n)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!list.length){ box.innerHTML = '<div class="notif-empty">No notifications</div>'; return; }
  box.innerHTML = list.map(n=>`
    <div class="notif-row">
      <div class="n-title">${esc(n.title||'')}</div>
      <div class="n-msg">${esc(n.message||'')}</div>
      <div class="n-time">${formatTimeAgo(n.createdAt)}</div>
    </div>`).join('');
}
function openNotifications(){
  goTo('notifications');
  if(me){
    const updates = {};
    Object.keys(notifCache).forEach(id=>{ updates['users/'+uid+'/seenNotifs/'+id] = true; });
    if(Object.keys(updates).length) db.ref().update(updates);
    document.getElementById('notif-dot').style.display = 'none';
  }
}

// Daily claim flow: wallet connected? -> then watch ad -> then reward.
// If no wallet is connected yet, send the user to connect one first — no ad is shown for that step.
function claimAdGateClick(){
  if(!me || me.claimedToday) return;
  if(!hasWallet()){
    showToast('Connect a wallet first to claim your daily reward');
    openWallet();
    return;
  }
  adGateClick('claim');
}
// Every gated button's real action, keyed by the data-ad-gate value used in index.html.
Object.assign(AD_GATE_ACTIONS, {
  claim: claimDaily,
  withdraw: submitWithdraw,
  deposit: submitDeposit,
  swap: doUnifiedSwap,
  walletConnect: saveWalletAddress
});
initAdGates();

/* ---------------- INIT ---------------- */
boot();