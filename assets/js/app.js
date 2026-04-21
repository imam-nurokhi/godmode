/**
 * Nexora Support v2.0 — IT Helpdesk Dashboard
 * app.js — Data pipeline + UI rendering
 */
'use strict';

/* ═══ CONSTANTS ═══ */
const PER_PAGE = 20;
const AVATAR_COLORS = [
  '#00d4aa','#4f94f8','#a371f7','#f0883e',
  '#3fb950','#f85149','#db61a2','#58a6ff',
  '#e3b341','#79c0ff','#56d364','#ff9a3c',
];
const MONTH_SHORT = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };

/* ═══ STATE ═══ */
const state = {
  tickets: [], stats: null,
  filterStatus: '', filterCat: '', searchQ: '',
  page: 1, selectedId: null,
};

/* ═══ INIT ═══ */
async function init() {
  setTopbarDate();
  try {
    const res = await fetch('./data/tickets.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    state.tickets = normalise(raw);
    state.stats   = computeStats(state.tickets);
    populateCatSelect();
    updateNavBadges();
    renderDonut();
    render();
    hideLoader();
  } catch (err) {
    document.getElementById('loading-screen').innerHTML = `
      <div style="text-align:center;padding:24px">
        <div style="font-size:32px;margin-bottom:16px">⚠️</div>
        <div style="color:var(--red);font-family:'JetBrains Mono',monospace;font-size:13px;margin-bottom:8px">Failed to load data</div>
        <div style="color:var(--t4);font-size:11px;margin-bottom:16px">${esc(err.message)}</div>
        <div style="color:var(--t4);font-size:10px;background:var(--bg3);padding:10px 16px;border-radius:8px;font-family:'JetBrains Mono',monospace">
          Run: python3 -m http.server 3000
        </div>
      </div>`;
  }
}

function setTopbarDate() {
  const el = document.getElementById('topbar-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

/* ═══ NORMALISE ═══ */
function normalise(raw) {
  return raw.map(t => {
    const user = t.user || {};
    const tags = (t.tags || []).map(g => g.display_name || g.name || '').filter(Boolean);
    const preview = stripHtml((t.latest_reply?.body || ''));
    return {
      id:      t.id,
      subject: t.subject || '',
      status:  (t.status || 'open').toLowerCase().replace(/ /g,'_'),
      created: fmtDate(t.created_at),
      updated: fmtDate(t.updated_at),
      closed:  fmtDate(t.closed_at),
      replies: t.replies_count || 0,
      user:    user.display_name || '',
      tags,
      preview,
      _ym:     (t.created_at || '').slice(0,7),
    };
  });
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
}

/* ═══ COMPUTE STATS ═══ */
function computeStats(tickets) {
  const byStatus={}, byCat={}, byMonth={}, userCount={};
  for (const t of tickets) {
    byStatus[t.status] = (byStatus[t.status]||0)+1;
    for (const tag of t.tags) byCat[tag] = (byCat[tag]||0)+1;
    if (t._ym) byMonth[t._ym] = (byMonth[t._ym]||0)+1;
    if (t.user) userCount[t.user] = (userCount[t.user]||0)+1;
  }
  const byCatArr   = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const byMonthArr = Object.entries(byMonth)
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([ym,cnt])=>{ const [yr,mo]=ym.split('-'); return [MONTH_SHORT[mo],`${MONTH_SHORT[mo]} '${yr.slice(2)}`,cnt]; });
  const topUsers = Object.entries(userCount)
    .sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([name,cnt],i)=>[name,cnt,AVATAR_COLORS[i%AVATAR_COLORS.length]]);
  const closed = byStatus.closed||0;
  return {
    total: tickets.length,
    resolveRate: tickets.length ? +((closed/tickets.length)*100).toFixed(1) : 0,
    byStatus: { open:byStatus.open||0, in_progress:byStatus.in_progress||0, pending:byStatus.pending||0, hold:byStatus.hold||0, closed },
    byCat:byCatArr, byMonth:byMonthArr, topUsers,
  };
}

/* ═══ LOADER ═══ */
function hideLoader() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(()=>el.remove(), 500);
}

/* ═══ DONUT CHART ═══ */
function renderDonut() {
  const el = document.getElementById('donutChart');
  const pctEl = document.getElementById('donutPct');
  if (!el || !state.stats) return;
  const { byStatus, resolveRate } = state.stats;
  const segments = [
    { val:byStatus.closed,      color:'#4f94f8' },
    { val:byStatus.open,        color:'#3fb950' },
    { val:byStatus.in_progress, color:'#f0883e' },
    { val:byStatus.pending,     color:'#a371f7' },
    { val:byStatus.hold,        color:'#f85149' },
  ].filter(s=>s.val>0);
  const total = segments.reduce((s,x)=>s+x.val,0);
  const cx=40, cy=40, r=32, stroke=8;
  const circ = 2*Math.PI*r;
  let offset = 0;
  let paths = '';
  for (const seg of segments) {
    const pct = seg.val/total;
    const dash = pct*circ;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${stroke}" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" style="transition:stroke-dasharray .6s ease"/>`;
    offset += dash;
  }
  paths += `<circle cx="${cx}" cy="${cy}" r="${r-stroke/2-2}" fill="var(--bg2)"/>`;
  el.innerHTML = paths;
  if (pctEl) pctEl.textContent = resolveRate+'%';
}

/* ═══ FILTER ═══ */
function getFiltered() {
  const q = state.searchQ.toLowerCase();
  return state.tickets.filter(t=>{
    if (q && !t.subject.toLowerCase().includes(q) &&
             !t.user.toLowerCase().includes(q) &&
             !String(t.id).includes(q)) return false;
    if (state.filterStatus && t.status!==state.filterStatus) return false;
    if (state.filterCat && !t.tags.includes(state.filterCat)) return false;
    return true;
  });
}

/* ═══ STATE SETTERS ═══ */
function navClick(el, status) {
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  el.classList.add('active');
  state.filterStatus = status; state.page=1; syncChips(); render();
}
function bnavClick(el, status) {
  document.querySelectorAll('.bnav-item').forEach(n=>n.classList.remove('active'));
  el.classList.add('active');
  state.filterStatus = status; state.filterCat=''; state.searchQ=''; state.page=1;
  const sq = document.getElementById('searchQ');
  if (sq) sq.value='';
  syncChips(); render();
  if (window.innerWidth<=768) { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('mob-overlay')?.classList.remove('show'); }
}
function setFilter(status) { state.filterStatus=status; state.page=1; syncChips(); render(); }
function setChip(el,status) { state.filterStatus=status; state.page=1; syncChips(); render(); }
function syncChips() {
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c.dataset.status===state.filterStatus));
}
function doFilter() {
  state.searchQ   = document.getElementById('searchQ')?.value||'';
  state.filterCat = document.getElementById('catSel')?.value||'';
  state.page=1; render();
}
function setPage(n) {
  state.filterStatus=''; state.filterCat=''; state.searchQ=''; state.page=1;
  const sq=document.getElementById('searchQ'); if(sq) sq.value='';
  const cs=document.getElementById('catSel');  if(cs) cs.value='';
  syncChips(); render();
  document.querySelectorAll('.nav-item').forEach((n,i)=>n.classList.toggle('active',i===0));
  document.querySelectorAll('.bnav-item').forEach((n,i)=>n.classList.toggle('active',i===0));
}
function goPage(p) {
  if (p<1) return; state.page=p; renderList();
  document.getElementById('ticketList')?.scrollTo({top:0,behavior:'smooth'});
}
function setCat(cat) { state.filterCat=cat; state.page=1; const s=document.getElementById('catSel'); if(s) s.value=cat; render(); }

/* ═══ HELPERS ═══ */
function isUrgent(s) { return /urgent/i.test(s); }
function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d.includes('T')?d:d+'T00:00:00');
  if (isNaN(dt)) return null;
  return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'});
}
function statusColor(s) {
  return {open:'var(--s-open)',in_progress:'var(--s-progress)',pending:'var(--s-pending)',closed:'var(--s-closed)',hold:'var(--s-hold)'}[s]||'var(--t4)';
}
function initials(name) {
  const p=name.split(/[.\s_\-]+/).filter(Boolean);
  return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():name.slice(0,2).toUpperCase();
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══ RENDER STATS ═══ */
function renderStats() {
  const el=document.getElementById('statsGrid');
  if (!el||!state.stats) return;
  const {total,byStatus,resolveRate}=state.stats;

  // mini sparkline (simple trend from byMonth)
  const months = (state.stats.byMonth||[]).slice(-8).map(([,,c])=>c);
  const maxM = Math.max(...months,1);
  function spark(vals,clr) {
    if (!vals.length) return '';
    const w=48,h=22,pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1||1)*w)},${Math.round(h-v/maxM*(h-3))}`).join(' ');
    return `<svg class="stat-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${clr}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/></svg>`;
  }

  const cards = [
    { label:'Total Tickets', val:total, key:'', clr:'#00d4aa', rgb:'0,212,170',
      icon:'<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>',
      delta:'all time', spark: spark(months,'#00d4aa') },
    { label:'Open', val:byStatus.open, key:'open', clr:'#3fb950', rgb:'63,185,80',
      icon:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>',
      delta:'needs attention', spark: spark(months.map(()=>Math.round(byStatus.open/total*10)),'#3fb950') },
    { label:'In Progress', val:byStatus.in_progress, key:'in_progress', clr:'#f0883e', rgb:'240,136,62',
      icon:'<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/>',
      delta:'being worked on' },
    { label:'Pending', val:byStatus.pending, key:'pending', clr:'#a371f7', rgb:'163,113,247',
      icon:'<circle cx="12" cy="12" r="10"/><path d="M10 9h4M10 15h4"/>',
      delta:'awaiting response' },
    { label:'Resolved', val:byStatus.closed, key:'closed', clr:'#4f94f8', rgb:'79,148,248',
      icon:'<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
      delta:`${resolveRate}% resolve rate`, deltaUp:true, spark: spark(months,'#4f94f8') },
  ];

  el.innerHTML = cards.map((c,i)=>`
    <div class="stat-card${state.filterStatus===c.key&&c.key?' active':''}"
         style="--stat-clr:${c.clr};--stat-rgb:${c.rgb};animation-delay:${i*.07}s"
         onclick="setChip(document.querySelectorAll('.chip')[${i}],'${c.key}')">
      <div class="stat-card-top">
        <div class="stat-icon"><svg viewBox="0 0 24 24">${c.icon}</svg></div>
        ${c.spark||''}
      </div>
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.val.toLocaleString()}</div>
      ${c.delta?`<div class="stat-delta${c.deltaUp?' up':''}">${c.delta}</div>`:''}
    </div>`).join('');
}

/* ═══ RENDER LIST ═══ */
function renderList() {
  const filtered=getFiltered();
  const totalP=Math.max(1,Math.ceil(filtered.length/PER_PAGE));
  if (state.page>totalP) state.page=1;
  const paged=filtered.slice((state.page-1)*PER_PAGE,state.page*PER_PAGE);
  const cntEl=document.getElementById('resultCount');
  if (cntEl) cntEl.textContent=`${filtered.length.toLocaleString()} result${filtered.length!==1?'s':''}`;
  const listEl=document.getElementById('ticketList');
  if (!listEl) return;

  if (!paged.length) {
    listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">🎫</div><p>No tickets match your filters.</p></div>`;
  } else {
    listEl.innerHTML=paged.map((t,i)=>{
      const urgent=isUrgent(t.subject);
      const subj=urgent?t.subject.replace(/\[urgent\]/i,'').trim():t.subject;
      const clr=statusColor(t.status);
      const user=t.user.split(/[.\s]/)[0]||t.user;
      return `
        <div class="t-row${t.id===state.selectedId?' selected':''}"
             style="animation-delay:${Math.min(i,12)*.025}s;--bar-clr:${clr}"
             onclick="openDetail(${t.id})">
          <div class="t-bar"></div>
          <div class="t-inner">
            <div class="t-top">
              ${urgent?'<span class="urgent-pill">⚡ URGENT</span>':''}
              <span class="t-subject">${esc(subj)}</span>
              <span class="t-id">#${t.id}</span>
            </div>
            <div class="t-bottom">
              <span class="status-badge s-${t.status}">${t.status.replace('_',' ')}</span>
              ${t.tags.slice(0,2).map(g=>`<span class="cat-tag">${esc(g)}</span>`).join('')}
              <span class="t-meta">
                <span class="t-replies"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${t.replies}</span>
                <span>${esc(user)}</span>
                <span>·</span>
                <span>${t.updated||'—'}</span>
              </span>
            </div>
          </div>
        </div>`;
    }).join('');
  }
  renderPager(filtered.length, totalP);
}

function renderPager(total, totalP) {
  const el=document.getElementById('pager');
  if (!el) return;
  if (totalP<=1) { el.innerHTML=''; return; }
  const btns=[];
  btns.push(`<button class="p-btn" onclick="goPage(${state.page-1})" ${state.page===1?'disabled':''}>‹</button>`);
  for (let i=1;i<=totalP;i++) {
    if (totalP<=7||i===1||i===totalP||Math.abs(i-state.page)<=1) {
      btns.push(`<button class="p-btn${i===state.page?' cur':''}" onclick="goPage(${i})">${i}</button>`);
    } else if (Math.abs(i-state.page)===2) {
      btns.push(`<span style="padding:0 2px;color:var(--t4);font-size:11px">…</span>`);
    }
  }
  btns.push(`<button class="p-btn" onclick="goPage(${state.page+1})" ${state.page===totalP?'disabled':''}>›</button>`);
  el.innerHTML=`
    <span class="pager-info">Page ${state.page} of ${totalP} · ${total.toLocaleString()} tickets</span>
    <div class="pager-btns">${btns.join('')}</div>`;
}

/* ═══ RENDER SIDEBAR ═══ */
function renderSidebar() {
  const el=document.getElementById('rightPanel');
  if (!el||!state.stats) return;
  const {byCat,byMonth,topUsers,total}=state.stats;

  const maxM=Math.max(...byMonth.map(([,,c])=>c),1);
  const gradients=['#00d4aa','#00d4aa','#00d4aa','#4f94f8','#4f94f8','#4f94f8','#f0883e','#f0883e','#a371f7','#a371f7'];
  const trend=byMonth.map(([lbl,full,c],i)=>{
    const h=Math.max(4,Math.round(c/maxM*52));
    return `<div class="trend-col" title="${esc(full)}: ${c}">
      <div class="trend-bar-bg"><div class="trend-bar" style="height:${h}px;background:${gradients[i]||'#4f94f8'};transition:height .5s ${i*.05}s ease"></div></div>
      <div class="trend-lbl">${lbl}</div>
    </div>`;
  }).join('');

  const maxC=byCat[0]?.[1]||1;
  const cats=byCat.slice(0,8).map(([name,cnt],i)=>`
    <div class="cat-bar-row" style="animation-delay:${i*.04}s">
      <span class="cat-bar-label" title="${esc(name)}">${esc(name)}</span>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${Math.round(cnt/maxC*100)}%"></div></div>
      <span class="cat-bar-count">${cnt}</span>
    </div>`).join('');

  const users=topUsers.map(([name,cnt,col])=>`
    <div class="user-row">
      <div class="u-avatar-sm" style="background:${col}1a;color:${col}">${initials(name)}</div>
      <span class="u-name-sm" title="${esc(name)}">${esc(name)}</span>
      <span class="u-cnt-sm">${cnt}</span>
    </div>`).join('');

  const range=byMonth.length>=2?`${byMonth[0][1]} – ${byMonth.at(-1)[1]}`:'All time';

  el.innerHTML=`
    <div class="r-card">
      <div class="r-card-head"><span class="r-card-title">Monthly Volume</span><span class="r-card-sub">${esc(range)}</span></div>
      <div class="r-card-body"><div class="trend-wrap">${trend}</div></div>
    </div>
    <div class="r-card">
      <div class="r-card-head"><span class="r-card-title">By Category</span><span class="r-card-sub">${total} total</span></div>
      <div class="r-card-body">${cats}</div>
    </div>
    <div class="r-card">
      <div class="r-card-head"><span class="r-card-title">Top Requesters</span><span class="r-card-sub">all time</span></div>
      <div class="r-card-body">${users}</div>
    </div>`;
}

/* ═══ DETAIL DRAWER ═══ */
function openDetail(id) {
  state.selectedId=id;
  const t=state.tickets.find(x=>x.id===id);
  if (!t) return;
  const urgent=isUrgent(t.subject);
  const subj=urgent?t.subject.replace(/\[urgent\]/i,'').trim():t.subject;
  document.getElementById('drawerBody').innerHTML=`
    <div class="drawer-status-row">
      <span class="status-badge s-${t.status}">${t.status.replace('_',' ')}</span>
      ${urgent?'<span class="urgent-pill">⚡ URGENT</span>':''}
      ${t.tags.map(g=>`<span class="cat-tag">${esc(g)}</span>`).join('')}
    </div>
    <div class="drawer-subject">${esc(subj)}</div>
    <div class="drawer-meta-grid">
      <span class="dm-key">ticket_id</span><span class="dm-val mono">#${t.id}</span>
      <span class="dm-key">requester</span><span class="dm-val">${esc(t.user)}</span>
      <span class="dm-key">created</span><span class="dm-val mono">${t.created||'—'}</span>
      <span class="dm-key">updated</span><span class="dm-val mono">${t.updated||'—'}</span>
      ${t.closed?`<span class="dm-key">resolved</span><span class="dm-val mono">${t.closed}</span>`:''}
      <span class="dm-key">replies</span><span class="dm-val mono">${t.replies}</span>
    </div>
    ${t.preview?`
    <div class="reply-box">
      <div class="reply-label">Latest Reply</div>
      <div class="reply-text">${esc(t.preview.slice(0,400))}${t.preview.length>400?'…':''}</div>
      <div class="reply-date">${t.updated||'—'}</div>
    </div>`:''}`;
  document.getElementById('detail-overlay').classList.add('show');
  renderList();
}
function closeDetail(e) {
  if (e&&e.target!==document.getElementById('detail-overlay')) return;
  document.getElementById('detail-overlay').classList.remove('show');
  state.selectedId=null; renderList();
}

/* ═══ SIDEBAR TOGGLE ═══ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mob-overlay').classList.toggle('show');
}

/* ═══ CAT SELECT ═══ */
function populateCatSelect() {
  const s=document.getElementById('catSel');
  if (!s||!state.stats) return;
  while (s.options.length>1) s.remove(1);
  for (const [name] of state.stats.byCat) {
    const o=document.createElement('option');
    o.value=name; o.textContent=name; s.appendChild(o);
  }
}
function updateNavBadges() {
  if (!state.stats) return;
  const o=document.getElementById('nav-open');
  const p=document.getElementById('nav-progress');
  const sb=document.getElementById('sb-total');
  if (o) o.textContent=state.stats.byStatus.open;
  if (p) p.textContent=state.stats.byStatus.in_progress;
  if (sb) sb.textContent=state.stats.total.toLocaleString();
}

/* ═══ MAIN RENDER ═══ */
function render() { renderStats(); renderList(); renderSidebar(); }

/* ═══ KEYBOARD ═══ */
document.addEventListener('keydown', e => {
  if (e.key==='Escape') closeDetail({target:document.getElementById('detail-overlay')});
  if ((e.ctrlKey||e.metaKey)&&e.key==='k') { e.preventDefault(); document.getElementById('searchQ')?.focus(); }
});

document.addEventListener('DOMContentLoaded', init);
