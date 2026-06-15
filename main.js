/* main.js — HerShield AI+ (complete, voice SOS improved, live-share, structured listings) */

/* Storage keys */
const KEY_USER = 'hs_user';
const EVIDENCE_DB = 'hs_evidence_db';
const EVIDENCE_STORE = 'evidence';
const REG_DB = 'hs_registrations';
const REG_STORE = 'registrations';
const VOICE_DB = 'hs_voice_db';
const VOICE_STORE = 'voice_enrollments';
const TRUSTED_DB = 'hs_trusted_db';
const TRUSTED_STORE = 'trusted_contacts';

/* Utilities */
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function ensureModalRoot(){ let root = document.getElementById('modalRoot'); if(!root){ root = document.createElement('div'); root.id='modalRoot'; document.body.appendChild(root);} return root; }
function nowISO(){ return new Date().toISOString(); }

/* Modal helper */
function showModal({ title='', html='', primaryText='OK', primaryAction=null, secondaryText='Close', secondaryAction=null } = {}){
  const root = ensureModalRoot(); root.innerHTML=''; root.setAttribute('aria-hidden','false');
  const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
  const modal = document.createElement('div'); modal.className='modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
  modal.innerHTML = `<h3 style="margin:0 0 8px 0">${escapeHtml(title)}</h3><div>${html}</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="modalSecondary" class="btn">${escapeHtml(secondaryText)}</button><button id="modalPrimary" class="btn primary">${escapeHtml(primaryText)}</button></div>`;
  backdrop.appendChild(modal); root.appendChild(backdrop);
  const primaryBtn = modal.querySelector('#modalPrimary'); const secondaryBtn = modal.querySelector('#modalSecondary');
  secondaryBtn.focus();
  function cleanup(){ root.innerHTML=''; root.setAttribute('aria-hidden','true'); }
  secondaryBtn.addEventListener('click', ()=>{ if(typeof secondaryAction === 'function') secondaryAction(); cleanup(); });
  primaryBtn.addEventListener('click', ()=>{ if(typeof primaryAction === 'function') primaryAction(); cleanup(); });
  backdrop.addEventListener('click', (e)=>{ if(e.target === backdrop) cleanup(); });
  document.addEventListener('keydown', function onKey(e){ if(e.key === 'Escape'){ cleanup(); document.removeEventListener('keydown', onKey); } });
}

/* IndexedDB wrapper */
function openDB(name, version=1, upgradeFn){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = ()=> { const db = req.result; if(typeof upgradeFn === 'function') upgradeFn(db); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

/* Generic store helpers */
async function putRecord(dbName, storeName, rec){
  const db = await openDB(dbName, 1, (db)=>{ if(!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath:'id' }); });
  return new Promise((res, rej)=>{
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.put(rec);
    r.onsuccess = ()=> res(rec.id);
    r.onerror = ()=> rej(r.error);
  });
}
async function addRecord(dbName, storeName, rec){
  const db = await openDB(dbName, 1, (db)=>{ if(!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath:'id' }); });
  return new Promise((res, rej)=>{
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.add(rec);
    r.onsuccess = ()=> res(rec.id);
    r.onerror = ()=> rej(r.error);
  });
}
async function getAll(dbName, storeName){
  const db = await openDB(dbName, 1, (db)=>{ if(!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath:'id' }); });
  return new Promise((res, rej)=>{
    const tx = db.transaction(storeName,'readonly');
    const store = tx.objectStore(storeName);
    const r = store.getAll();
    r.onsuccess = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
  });
}
async function getById(dbName, storeName, id){
  const db = await openDB(dbName, 1, (db)=>{ if(!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath:'id' }); });
  return new Promise((res, rej)=>{
    const tx = db.transaction(storeName,'readonly');
    const store = tx.objectStore(storeName);
    const r = store.get(id);
    r.onsuccess = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
  });
}
async function deleteById(dbName, storeName, id){
  const db = await openDB(dbName, 1, (db)=>{ if(!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath:'id' }); });
  return new Promise((res, rej)=>{
    const tx = db.transaction(storeName,'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.delete(id);
    r.onsuccess = ()=> res(true);
    r.onerror = ()=> rej(r.error);
  });
}

/* Evidence helpers */
async function saveEvidenceBlob({ type, filename, blob, meta={} }){
  const id = 'evidence-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
  const rec = { id, type, filename, blob, ts: Date.now(), meta };
  await addRecord(EVIDENCE_DB, EVIDENCE_STORE, rec);
  return id;
}
async function listEvidence(){ return getAll(EVIDENCE_DB, EVIDENCE_STORE); }

/* Registration helpers */
async function saveRegistration(rec){
  rec.id = rec.id || ('reg-' + Date.now() + '-' + Math.random().toString(36).slice(2,6));
  rec.ts = rec.ts || Date.now();
  await addRecord(REG_DB, REG_STORE, rec);
  return rec.id;
}

/* Trusted contacts helpers */
async function ensureTrustedStore(){
  const db = await openDB(TRUSTED_DB, 1, (db)=>{ if(!db.objectStoreNames.contains(TRUSTED_STORE)) db.createObjectStore(TRUSTED_STORE, { keyPath:'id' }); });
  return db;
}
async function addTrustedContact(contact){
  contact.id = contact.id || ('tc-' + Date.now() + '-' + Math.random().toString(36).slice(2,6));
  contact.ts = Date.now();
  await addRecord(TRUSTED_DB, TRUSTED_STORE, contact);
  return contact.id;
}
async function listTrustedContacts(){ return getAll(TRUSTED_DB, TRUSTED_STORE); }
async function deleteTrustedContact(id){ return deleteById(TRUSTED_DB, TRUSTED_STORE, id); }

/* Voice enrollment helpers */
async function createVoiceEnrollment(keywords){
  const rec = { id: 'voice-' + Date.now(), keywords: keywords.map(k=>k.toLowerCase()), samples: [], enabled: false, ts: Date.now() };
  await putRecord(VOICE_DB, VOICE_STORE, rec);
  return rec;
}
async function addVoiceSample(enrollmentId, blob, transcript){
  const rec = await getById(VOICE_DB, VOICE_STORE, enrollmentId);
  if(!rec) throw new Error('Enrollment not found');
  rec.samples = rec.samples || [];
  rec.samples.push({ blob, transcript, ts: Date.now() });
  await putRecord(VOICE_DB, VOICE_STORE, rec);
  return rec;
}
async function setVoiceEnabled(enrollmentId, enabled){
  const rec = await getById(VOICE_DB, VOICE_STORE, enrollmentId);
  if(!rec) throw new Error('Enrollment not found');
  rec.enabled = !!enabled;
  await putRecord(VOICE_DB, VOICE_STORE, rec);
  return rec;
}
async function listVoiceEnrollments(){ return getAll(VOICE_DB, VOICE_STORE); }

/* Header render */
function renderHeaderIfNeeded(){
  const header = document.querySelector('.topbar');
  if(!header) return;
  const user = JSON.parse(localStorage.getItem(KEY_USER) || 'null');
  const left = header.querySelector('.left');
  if(left) left.innerHTML = `<div class="greeting">${user ? 'Welcome, ' + escapeHtml(user.name) : 'Welcome to HerShield AI+'}</div><div class="small-note">${user ? escapeHtml(user.location || '') : ''}</div>`;
  const signOutBtn = document.getElementById('signOutBtn');
  if(signOutBtn) signOutBtn.addEventListener('click', ()=> {
    showModal({
      title:'Sign out',
      html:'<p>Sign out and clear your profile from this browser?</p>',
      primaryText:'Sign out',
      primaryAction: ()=> { localStorage.removeItem(KEY_USER); location.href = 'index.html'; },
      secondaryText:'Cancel'
    });
  });
}
document.addEventListener('DOMContentLoaded', renderHeaderIfNeeded);

/* Geocoding (Nominatim) */
async function geocodePlace(query){
  if(!query) return null;
  const parts = query.split(',').map(s=>s.trim());
  if(parts.length===2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat:+parts[0], lng:+parts[1] };
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, { headers:{ 'Accept':'application/json' }});
    if(!res.ok) return null;
    const data = await res.json();
    if(!data || !data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display_name: data[0].display_name };
  } catch(e){
    return null;
  }
}

/* ---------------------------
   SOS recording (10s) — auto-save evidence, preview, progress
   --------------------------- */
async function triggerSOSDemo(extraMeta = {}){
  const ts = nowISO();
  const meta = Object.assign({ timestamp: ts }, extraMeta);
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy:true, timeout:10000 }));
    meta.location = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch(e){
    meta.location = null;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };

    // modal with progress
    const root = ensureModalRoot(); root.innerHTML = '';
    const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div'); modal.className = 'modal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
    modal.innerHTML = `<h3 style="margin:0 0 8px 0">Recording evidence</h3>
      <div><p>Recording short evidence (10s). You can stop early or let it finish automatically.</p>
      <div class="recorder-bar"><div id="recProgress" class="recorder-progress"></div></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="stopRec" class="btn primary">Stop now</button><button id="cancelRec" class="btn">Cancel</button></div></div>`;
    backdrop.appendChild(modal); root.appendChild(backdrop);

    recorder.start();
    const progressEl = modal.querySelector('#recProgress');
    const stopBtn = modal.querySelector('#stopRec');
    const cancelBtn = modal.querySelector('#cancelRec');

    let stopped = false;
    stopBtn.addEventListener('click', ()=> { if(recorder.state !== 'inactive') recorder.stop(); });
    cancelBtn.addEventListener('click', ()=> { if(recorder.state !== 'inactive') recorder.stop(); });

    const totalMs = 10000;
    const start = Date.now();
    const tick = setInterval(()=> {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed/totalMs)*100));
      progressEl.style.width = pct + '%';
    }, 150);

    await new Promise(r => setTimeout(r, totalMs));
    if(recorder.state !== 'inactive') recorder.stop();
    await new Promise(resolve => recorder.onstop = resolve);
    clearInterval(tick);
    progressEl.style.width = '100%';

    const blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'video/webm' });
    const filename = `sos-${Date.now()}.webm`;
    const url = URL.createObjectURL(blob);

    // Auto-save evidence (always saved)
    try {
      const id = await saveEvidenceBlob({ type:'sos-media', filename, blob, meta });
      // show preview modal with saved confirmation
      root.innerHTML = '';
      const previewBackdrop = document.createElement('div'); previewBackdrop.className = 'modal-backdrop';
      const previewModal = document.createElement('div'); previewModal.className = 'modal';
      previewModal.innerHTML = `<h3 style="margin:0 0 8px 0">Evidence recorded</h3>
        <div>
          <p><strong>Timestamp</strong> ${escapeHtml(ts)}</p>
          <p><strong>Location</strong> ${meta.location ? `${meta.location.lat.toFixed(5)}, ${meta.location.lng.toFixed(5)} (acc ${meta.location.accuracy}m)` : 'Unavailable'}</p>
          <video controls style="width:100%;border-radius:8px;margin-top:8px"><source src="${url}"></video>
          <div style="margin-top:8px" class="small-note">Evidence saved locally (id: ${id}). You can review or delete it from Evidence Viewer.</div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="previewClose" class="btn primary">Close</button></div>
        </div>`;
      previewBackdrop.appendChild(previewModal); root.appendChild(previewBackdrop);
      previewModal.querySelector('#previewClose').addEventListener('click', ()=> { root.innerHTML=''; });
    } catch(err){
      showModal({ title:'Save error', html:'<p>Unable to save evidence locally.</p>', primaryText:'OK' });
    }

    stream.getTracks().forEach(t=>t.stop());
  } catch(err){
    showModal({ title:'Media error', html:'<p>Camera/microphone access denied or unavailable.</p>', primaryText:'OK' });
  }
}

/* Evidence viewer */
async function renderEvidenceList(container){
  const list = await listEvidence();
  container.innerHTML = '';
  if(!list.length){ container.innerHTML = '<div class="small-note">No evidence saved.</div>'; return; }
  list.forEach(rec=>{
    const row = document.createElement('div'); row.className='card'; row.style.marginBottom='8px';
    const date = new Date(rec.ts).toLocaleString();
    row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-weight:800">${escapeHtml(rec.type)}</div><div class="small-note">${escapeHtml(rec.filename)} • ${date}</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn" data-id="${rec.id}" data-action="play">Play</button>
        <button class="btn" data-id="${rec.id}" data-action="download">Download</button>
        <button class="btn" data-id="${rec.id}" data-action="delete">Delete</button>
      </div>
    </div>`;
    container.appendChild(row);

    row.querySelector('[data-action="play"]').addEventListener('click', async ()=>{
      const blob = rec.blob;
      const url = URL.createObjectURL(blob);
      showModal({ title:'Play evidence', html:`<video controls style="width:100%"><source src="${url}"></video>`, primaryText:'Close' });
    });
    row.querySelector('[data-action="download"]').addEventListener('click', ()=>{
      const a = document.createElement('a'); const url = URL.createObjectURL(rec.blob);
      a.href = url; a.download = rec.filename || 'evidence.webm'; document.body.appendChild(a); a.click(); a.remove();
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', async ()=>{
      await deleteById(EVIDENCE_DB, EVIDENCE_STORE, rec.id);
      renderEvidenceList(container);
      showModal({ title:'Deleted', html:'<p>Evidence deleted.</p>', primaryText:'OK' });
    });
  });
}

/* ---------------------------
   Voice SOS: enrollment & robust detection
   - detection requires keyword seen twice within short window to reduce false positives
   --------------------------- */

let _voiceListener = null;
let _detectionBuffer = []; // {kw, ts}
const DETECTION_WINDOW_MS = 8000; // window to consider repeated detections
const REQUIRED_REPEATS = 2; // require keyword repeated this many times within window

async function startVoiceSOSListener(){
  if(_voiceListener) return;
  const enrollments = await listVoiceEnrollments();
  const enabled = (enrollments || []).filter(e=>e.enabled);
  if(!enabled.length) return;
  const keywords = enabled.flatMap(e=>e.keywords || []);
  if(!keywords.length) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition) {
    console.warn('SpeechRecognition not supported');
    return;
  }
  const rec = new SpeechRecognition();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = async (ev) => {
    for(let i=ev.resultIndex;i<ev.results.length;i++){
      const text = ev.results[i][0].transcript || '';
      const t = text.toLowerCase();
      for(const kw of keywords){
        if(t.includes(kw.toLowerCase())){
          const now = Date.now();
          _detectionBuffer.push({ kw: kw.toLowerCase(), ts: now, transcript: text });
          // prune buffer
          _detectionBuffer = _detectionBuffer.filter(x => (now - x.ts) <= DETECTION_WINDOW_MS);
          // count repeats for this keyword
          const count = _detectionBuffer.filter(x => x.kw === kw.toLowerCase()).length;
          if(count >= REQUIRED_REPEATS){
            // clear buffer to avoid duplicate triggers
            _detectionBuffer = [];
            // stop listener to avoid duplicates
            stopVoiceSOSListener();
            // trigger SOS with transcript meta
            showModal({ title:'Voice SOS detected', html:`<p>Detected keyword "${escapeHtml(kw)}" repeatedly. Triggering SOS (demo).</p>`, primaryText:'OK', primaryAction: ()=> triggerSOSDemo({ trigger: 'voice-sos', detectedKeyword: kw, transcript: text }) });
            return;
          }
        }
      }
    }
  };
  rec.onerror = (e)=> { console.warn('Voice listener error', e); };
  try {
    rec.start();
    _voiceListener = rec;
    console.log('Voice SOS listener started');
  } catch(e){
    console.warn('Could not start voice listener', e);
  }
}
function stopVoiceSOSListener(){
  if(!_voiceListener) return;
  try { _voiceListener.stop(); } catch(e){}
  _voiceListener = null;
  _detectionBuffer = [];
  console.log('Voice SOS listener stopped');
}

/* Enrollment UI helpers (used by Home) */
function openVoiceEnrollmentModal(){
  const root = ensureModalRoot(); root.innerHTML = '';
  const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal';
  modal.innerHTML = `<h3 style="margin:0 0 8px 0">Voice SOS Enrollment</h3>
    <div>
      <p>Enter keywords (comma separated) that you will say to trigger Voice SOS. Then record 3 short samples saying those keywords. Keep them natural.</p>
      <label class="field"><span class="label">Keywords</span><input id="voiceKeywords" class="input" placeholder="e.g., help, emergency, police"></label>
      <div style="display:flex;gap:8px;margin-top:8px"><button id="startEnroll" class="btn primary">Start Enrollment</button><button id="closeEnroll" class="btn">Close</button></div>
      <div id="enrollArea" style="margin-top:12px"></div>
    </div>`;
  backdrop.appendChild(modal); root.appendChild(backdrop);

  modal.querySelector('#closeEnroll').addEventListener('click', ()=> { root.innerHTML=''; });
  modal.querySelector('#startEnroll').addEventListener('click', async ()=>{
    const kw = modal.querySelector('#voiceKeywords').value.trim();
    if(!kw){ alert('Enter at least one keyword'); return; }
    const keywords = kw.split(',').map(s=>s.trim()).filter(Boolean);
    const enrollment = await createVoiceEnrollment(keywords);
    showVoiceSampleRecorder(enrollment.id, modal.querySelector('#enrollArea'));
  });
}

/* Show recorder UI for 3 samples */
function showVoiceSampleRecorder(enrollmentId, container){
  container.innerHTML = '';
  const info = document.createElement('div'); info.className='small-note'; info.textContent = 'Record 3 short samples (saying your keywords).';
  container.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='8px'; list.style.marginTop='8px';
  container.appendChild(list);

  let sampleIndex = 0;
  async function recordSample(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alert('Microphone not available'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
      recorder.start();
      const row = document.createElement('div'); row.className='card'; row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div>Recording sample ${sampleIndex+1}...</div><div><button class="btn" id="stopSample">Stop</button></div></div><div class="recorder-bar"><div class="recorder-progress" style="width:0%"></div></div>`;
      list.appendChild(row);
      const stopBtn = row.querySelector('#stopSample');
      stopBtn.addEventListener('click', ()=> { if(recorder.state !== 'inactive') recorder.stop(); });
      // auto stop after 4s
      const maxMs = 4000;
      const start = Date.now();
      const tick = setInterval(()=> {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, Math.round((elapsed/maxMs)*100));
        row.querySelector('.recorder-progress').style.width = pct + '%';
      }, 120);
      await new Promise(r => setTimeout(r, maxMs));
      if(recorder.state !== 'inactive') recorder.stop();
      await new Promise(resolve => recorder.onstop = resolve);
      clearInterval(tick);
      row.querySelector('.recorder-progress').style.width = '100%';
      const blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' });
      // quick speech-to-text using Web Speech API (best-effort)
      let transcript = '';
      if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
        transcript = await transcribeBlob(blob).catch(()=>'');
      }
      await addVoiceSample(enrollmentId, blob, transcript);
      sampleIndex++;
      const doneNote = document.createElement('div'); doneNote.className='small-note'; doneNote.textContent = `Saved sample ${sampleIndex}. Transcript: ${transcript || '[no transcript]'}`;
      row.appendChild(doneNote);
      stream.getTracks().forEach(t=>t.stop());
      if(sampleIndex < 3){
        const nextBtn = document.createElement('button'); nextBtn.className='btn primary'; nextBtn.textContent = 'Record next sample'; nextBtn.addEventListener('click', recordSample);
        container.appendChild(nextBtn);
      } else {
        const finishBtn = document.createElement('button'); finishBtn.className='btn primary'; finishBtn.textContent = 'Finish Enrollment'; finishBtn.addEventListener('click', async ()=>{
          await setVoiceEnabled(enrollmentId, true);
          showModal({ title:'Enrollment complete', html:'<p>Voice SOS enrollment complete and enabled. When Voice SOS is enabled, saying your keywords will trigger SOS automatically (demo).</p>', primaryText:'OK' });
          container.innerHTML = '';
        });
        container.appendChild(finishBtn);
      }
    } catch(err){
      alert('Recording failed: ' + (err && err.message ? err.message : err));
    }
  }

  // start first sample automatically
  recordSample();
}

/* Transcribe a blob using SpeechRecognition by playing it and listening — best-effort */
function transcribeBlob(blob){
  return new Promise((resolve, reject) => {
    if(!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return resolve('');
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(blob);
    audio.play().catch(()=>{});
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e)=> {
      const t = e.results[0][0].transcript || '';
      try{ rec.stop(); }catch(e){}
      resolve(t);
    };
    rec.onerror = ()=> { try{ rec.stop(); }catch(e){}; resolve(''); };
    try {
      rec.start();
      setTimeout(()=>{ try{ rec.stop(); }catch(e){}; }, 4500);
    } catch(e){
      resolve('');
    }
  });
}

/* ---------------------------
   Live location sharing (demo)
   - stores trusted contacts locally
   - share creates a short sharable link (lat,lng) and copies to clipboard
   --------------------------- */

async function shareLiveLocationOnce(){
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy:true, timeout:10000 }));
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    const shareUrl = `${location.origin}${location.pathname}?share=${lat},${lng}&ts=${Date.now()}`;
    await navigator.clipboard.writeText(shareUrl);
    showModal({ title:'Share link copied', html:`<p>Live location link copied to clipboard. Share it with your trusted contacts.</p><p><strong>${escapeHtml(shareUrl)}</strong></p>`, primaryText:'OK' });
    return shareUrl;
  } catch(e){
    showModal({ title:'Location error', html:'<p>Unable to get location. Please allow location access.</p>', primaryText:'OK' });
    return null;
  }
}

/* Periodic live sharing simulation (copies link repeatedly) */
let _liveShareInterval = null;
async function startLiveShare(intervalSec = 15){
  if(_liveShareInterval) return;
  const contacts = await listTrustedContacts();
  if(!contacts || !contacts.length){
    showModal({ title:'No trusted contacts', html:'<p>Please add trusted contacts first in the Register page.</p>', primaryText:'OK' });
    return;
  }
  // start periodic copy (demo)
  _liveShareInterval = setInterval(async ()=>{
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy:true, timeout:10000 })).catch(()=>null);
    if(!pos) return;
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    const shareUrl = `${location.origin}${location.pathname}?share=${lat},${lng}&ts=${Date.now()}`;
    try { await navigator.clipboard.writeText(shareUrl); console.log('Live share link copied for contacts'); } catch(e){ console.log('Could not copy live share link'); }
  }, Math.max(5000, intervalSec*1000));
  showModal({ title:'Live sharing started', html:'<p>Live location will be periodically copied to clipboard (demo). Share the link with your trusted contacts.</p>', primaryText:'OK' });
}
function stopLiveShare(){
  if(_liveShareInterval){ clearInterval(_liveShareInterval); _liveShareInterval = null; showModal({ title:'Live sharing stopped', html:'<p>Live sharing stopped.</p>', primaryText:'OK' }); }
}

/* ---------------------------
   AI check-in helpers (used in ai.html)
   --------------------------- */
const CHECKIN_QUESTIONS = [
  "Are you safe right now? (yes/no)",
  "Where are you currently (area name or coordinates)?",
  "What happened or what made you feel uneasy? (brief)",
  "Is anyone with you? (yes/no) If yes, who and how many?",
  "Do you feel threatened, followed, or in immediate danger? (yes/no)",
  "Are you injured or need medical help? (yes/no)",
  "Can you move to a public, well-lit place or a shop? (yes/no)",
  "Do you want me to trigger SOS now? (yes/no)",
  "Would you like me to notify an emergency contact? (yes/no)",
  "Do you want me to stay in chat with you until help arrives?"
];

async function runCheckinFlow(sendUserMsg, sendBotMsg){
  sendBotMsg("Hi — I'm checking in with you. I'll ask a few quick questions to understand your situation.");
  for(let i=0;i<CHECKIN_QUESTIONS.length;i++){
    const q = CHECKIN_QUESTIONS[i];
    sendBotMsg(q);
    const ans = await waitForUserResponseInAI();
    sendUserMsg(ans);

    const kws = analyzeKeywords(ans);
    if(kws.includes('medical')){
      sendBotMsg("I detected medical keywords. If you are injured, consider calling emergency services immediately.");
    }
    if(kws.includes('threat')){
      sendBotMsg("I detected threat-related words. If you are in danger, I can trigger SOS now.");
    }
    if(kws.includes('lost')){
      sendBotMsg("If you're lost, share a nearby landmark or area name and I can help with a safe route.");
    }

    const a = ans.trim().toLowerCase();
    if(i===0 && (a === 'no' || a === 'n' || a.includes('no'))){
      sendBotMsg("You said you're not safe. I will escalate and offer SOS.");
      const confirmNow = confirm('You indicated you are not safe. Trigger SOS now?');
      if(confirmNow) { await triggerSOSDemo(); return; } else { sendBotMsg("Okay, I won't trigger SOS. Stay on the line."); }
    }
    if(i===4 && (a === 'yes' || a === 'y' || a.includes('yes'))){
      sendBotMsg("You feel threatened. I recommend triggering SOS.");
      const confirmNow = confirm('You feel threatened. Trigger SOS now?');
      if(confirmNow) { await triggerSOSDemo(); return; } else { sendBotMsg("Okay, stay safe. Consider moving to a public area."); }
    }
    if(i===7 && (a === 'yes' || a === 'y' || a.includes('yes'))){
      await triggerSOSDemo(); return;
    }
  }
  sendBotMsg("Check-in complete. If you need anything else, I'm here.");
}

/* Wait for user response in AI chat (used by ai.html) */
function waitForUserResponseInAI(timeoutMs=120000){
  return new Promise((resolve)=>{
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const quickYes = document.getElementById('quickYes');
    const quickNo = document.getElementById('quickNo');
    const quickSOS = document.getElementById('quickSOS');
    let resolved = false;
    function cleanup(v){
      if(resolved) return;
      resolved = true;
      sendBtn.removeEventListener('click', onSend);
      quickYes.removeEventListener('click', onYes);
      quickNo.removeEventListener('click', onNo);
      quickSOS.removeEventListener('click', onSOS);
      resolve(v);
    }
    function onSend(){
      const v = input.value.trim();
      if(!v) return;
      input.value = '';
      cleanup(v);
    }
    function onYes(){ cleanup('yes'); }
    function onNo(){ cleanup('no'); }
    function onSOS(){ cleanup('yes'); }
    sendBtn.addEventListener('click', onSend);
    quickYes.addEventListener('click', onYes);
    quickNo.addEventListener('click', onNo);
    quickSOS.addEventListener('click', onSOS);
    setTimeout(()=>{ if(!resolved) cleanup(''); }, timeoutMs);
  });
}

/* ---------------------------
   Keyword analyzer (AI assistance)
   --------------------------- */
function analyzeKeywords(text){
  const t = (text||'').toLowerCase();
  const keywords = [];
  if(/\b(attack|assault|follow|stalk|threat|danger|unsafe|harass|abuse|robbery)\b/.test(t)) keywords.push('threat');
  if(/\b(lost|lost my way|confused|where am i|disoriented)\b/.test(t)) keywords.push('lost');
  if(/\b(bleed|injur|hurt|pain|medical|unconscious|fracture)\b/.test(t)) keywords.push('medical');
  if(/\b(police|cop|patrol|officer|station)\b/.test(t)) keywords.push('police');
  if(/\b(ride|driver|taxi|cab|uber|ola|auto)\b/.test(t)) keywords.push('transport');
  if(/\b(unsafe|scared|panic|anxious)\b/.test(t)) keywords.push('emotional');
  return keywords;
}

/* Expose functions globally for pages */
window.triggerSOSDemo = triggerSOSDemo;
window.renderEvidenceList = renderEvidenceList;
window.listVoiceEnrollments = listVoiceEnrollments;
window.setVoiceEnabled = setVoiceEnabled;
window.openVoiceEnrollmentModal = openVoiceEnrollmentModal;
window.startVoiceSOSListener = startVoiceSOSListener;
window.stopVoiceSOSListener = stopVoiceSOSListener;
window.addTrustedContact = addTrustedContact;
window.listTrustedContacts = listTrustedContacts;
window.deleteTrustedContact = deleteTrustedContact;
window.shareLiveLocationOnce = shareLiveLocationOnce;
window.startLiveShare = startLiveShare;
window.stopLiveShare = stopLiveShare;
window.runCheckinFlow = runCheckinFlow;
