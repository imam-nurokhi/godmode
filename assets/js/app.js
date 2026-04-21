/**
 * Nexora Support — IT Helpdesk Dashboard
 * app.js — Main application logic
 *
 * Loads ticket data from /data/tickets.json, computes live statistics,
 * and drives the full UI: filtering, pagination, drawer, sidebar charts.
 *
 * @version  1.0.0
 * @repo     github.com/imam-nurokhi/godmode
 */

'use strict';

/* ════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════ */
const PER_PAGE   = 20;
const AVATAR_COLORS = [
  '#4f94f8','#00d4aa','#a371f7','#f0883e',
  '#3fb950','#f85149','#ff9a3c','#58a6ff',
  '#e3b341','#db61a2','#79c0ff','#56d364',
];
const MONTH_LABELS = {
  '01':'Jan','02':'Feb','03':'Mar','04':'Apr',
  '05':'May','06':'Jun','07':'Jul','08':'Aug',
  '09':'Sep','10':'Oct','11':'Nov','12':'Dec',
};

/* ════════════════════════════════════════
   APPLICATION STATE
════════════════════════════════════════ */
const state = {
  tickets:      [],   // raw ticket objects from JSON
  stats:        null, // computed stats object
  filterStatus: '',
  filterCat:    '',
  searchQ:      '',
  page:         1,
  selectedId:   null,
};

/* ════════════════════════════════════════
   DATA LOADING & STATS COMPUTATION
════════════════════════════════════════ */

/**
 * Fetch tickets from data/tickets.json and bootstrap the app.
 */
async function init() {
  try {
    showLoader('Fetching tickets…');
    const res  = await fetch('./data/tickets.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw  = await res.json();
    state.tickets = normalise(raw);
    state.stats   = computeStats(state.tickets);
    populateCatSelect();
    updateNavBadges();
    render();
    hideLoader();
  } catch (err) {
    console.error('[Nexora] Failed to load tickets:', err);
    document.getElementById('loading-screen').innerHTML =
      `<div style="text-align:center;color:var(--red);font-family:'JetBrains Mono',monospace;font-size:13px">
        ⚠ Failed to load data<br><span style="color:var(--t4);font-size:11px;margin-top:8px;display:block">${err.message}</span>
        <span style="color:var(--t4);font-size:10px;margin-top:6px;display:block">Run a local server: python3 -m http.server</span>
       </div>`;
  }
}

/**
 * Normalise raw API tickets into a lean shape the UI needs.
 * @param {Array} raw
 * @returns {Array}
 */
function normalise(raw) {
  return raw.map(t => {
    const user = t.user || {};
    const tags = (t.tags || []).map(g => g.display_name || g.name || '').filter(Boolean);
    const preview = (t.latest_reply?.body || '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    return {
      id:       t.id,
      subject:  t.subject || '',
      status:   t.status  || 'open',
      created:  fmtDate(t.created_at),
      updated:  fmtDate(t.updated_at),
      closed:   fmtDate(t.closed_at),
      replies:  t.replies_count || 0,
      user:     user.display_name || '',
      avatar:   user.avatar || '',
      tags,
      preview,
      _ym:      (t.created_at || '').slice(0, 7), // YYYY-MM for grouping
    };
  });
}

/**
 * Compute all dashboard statistics from the normalised ticket array.
 * @param {Array} tickets
 * @returns {Object}
 */
function computeStats(tickets) {
  const byStatus  = {};
  const byCat     = {};
  const byMonth   = {};
  const userCount = {};

  for (const t of tickets) {
    // Status
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    // Category
    for (const tag of t.tags) byCat[tag] = (byCat[tag] || 0) + 1;
    // Month
    if (t._ym) byMonth[t._ym] = (byMonth[t._ym] || 0) + 1;
    // User
    if (t.user) userCount[t.user] = (userCount[t.user] || 0) + 1;
  }

  // Sorted arrays
  const byCatArr  = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const byMonthArr = Object.entries(byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, cnt]) => {
      const [yr, mo] = ym.split('-');
      return [MONTH_LABELS[mo], `${MONTH_LABELS[mo]} '${yr.slice(2)}`, cnt];
    });
  const topUsers  = Object.entries(userCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, cnt], i) => [name, cnt, AVATAR_COLORS[i % AVATAR_COLORS.length]]);

  const closed = byStatus.closed || 0;
  const resolveRate = tickets.length ? ((closed / tickets.length) * 100).toFixed(1) : 0;

  return {
    total: tickets.length,
    resolveRate,
    byStatus: {
      open:        byStatus.open        || 0,
      in_progress: byStatus.in_progress || 0,
      pending:     byStatus.pending     || 0,
      hold:        byStatus.hold        || 0,
      closed,
    },
    byCat:     byCatArr,
    byMonth:   byMonthArr,
    topUsers,
  };
}

/* ════════════════════════════════════════
   LOADING SCREEN
════════════════════════════════════════ */
function showLoader(msg = 'Loading…') {
  const el = document.getElementById('loading-screen');
  if (el) el.querySelector('.loader-text').textContent = msg;
}
function hideLoader() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.classList.add('fade-out');
  setTimeout(() => el.remove(), 450);
}

/* ════════════════════════════════════════
   FILTER LOGIC
════════════════════════════════════════ */
function getFiltered() {
  const { tickets, filterStatus, filterCat, searchQ } = state;
  const q = searchQ.toLowerCase();
  return tickets.filter(t => {
    if (q && !t.subject.toLowerCase().includes(q) &&
             !t.user.toLowerCase().includes(q) &&
             !String(t.id).includes(q)) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterCat && !t.tags.includes(filterCat))  return false;
    return true;
  });
}

function setFilter(status) {
  state.filterStatus = status;
  state.page = 1;
  syncChips();
  syncNavActive();
  render();
}
function setCat(cat) {
  state.filterCat = cat;
  state.page = 1;
  const sel = document.getElementById('catSel');
  if (sel) sel.value = cat;
  render();
}
function doFilter() {
  state.searchQ   = document.getElementById('searchQ')?.value || '';
  state.filterCat = document.getElementById('catSel')?.value  || '';
  state.page = 1;
  render();
}
function setChip(el, status) {
  state.filterStatus = status;
  state.page = 1;
  syncChips();
  syncNavActive();
  render();
}
function syncChips() {
  document.querySelectorAll('.chip').forEach(c =>
    c.classList.toggle('active', c.dataset.status === state.filterStatus)
  );
}
function syncNavActive() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}
function setPage(p) {
  state.filterStatus = '';
  state.filterCat    = '';
  state.searchQ      = '';
  state.page = 1;
  const el = document.getElementById('searchQ');
  if (el) el.value = '';
  syncChips();
  render();
  document.querySelectorAll('.nav-item').forEach((n, i) => n.classList.toggle('active', i === 0));
  document.querySelectorAll('.bnav-item').forEach((n, i) => n.classList.toggle('active', i === 0));
}
function goPage(p) {
  if (p < 1) return;
  state.page = p;
  renderList();
  document.getElementById('ticketList')?.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function isUrgent(s) { return /urgent/i.test(s); }

function fmtDate(d) {
  if (!d) return null;
  const dt = new Date(d.includes('T') ? d : d + 'T00:00:00');
  if (isNaN(dt)) return null;
  return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' });
}

function statusColor(s) {
  return {
    open:        'var(--s-open)',
    in_progress: 'var(--s-progress)',
    pending:     'var(--s-pending)',
    closed:      'var(--s-closed)',
    hold:        'var(--s-hold)',
  }[s] || 'var(--t4)';
}

function initials(name) {
  const parts = name.split(/[.\s_\-]+/).filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ════════════════════════════════════════
   RENDER — STATS ROW
════════════════════════════════════════ */
function renderStats() {
  const el = document.getElementById('statsGrid');
  if (!el || !state.stats) return;
  const { total, byStatus, resolveRate } = state.stats;
  const cards = [
    {
      label: 'Total', val: total,
      icon:  `<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>`,
      clr:   'var(--teal)', key: '',
    },
    {
      label: 'Open', val: byStatus.open,
      icon:  `<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>`,
      clr:   'var(--s-open)', key: 'open',
    },
    {
      label: 'In Progress', val: byStatus.in_progress,
      icon:  `<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/>`,
      clr:   'var(--amber)', key: 'in_progress',
    },
    {
      label: 'Pending', val: byStatus.pending,
      icon:  `<circle cx="12" cy="12" r="10"/><path d="M10 9h4M10 15h4"/>`,
      clr:   'var(--violet)', key: 'pending',
    },
    {
      label: 'Closed', val: byStatus.closed,
      icon:  `<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
      clr:   'var(--s-closed)', key: 'closed',
      delta: `${resolveRate}% resolve rate`, deltaClr: 'up',
    },
  ];
  el.innerHTML = cards.map((c, i) => `
    <div class="stat-card${state.filterStatus === c.key && c.key ? ' active' : ''}"
         style="--stat-clr:${c.clr};animation-delay:${i * .07}s"
         onclick="setFilter('${c.key}')">
      <div class="stat-icon"><svg viewBox="0 0 24 24">${c.icon}</svg></div>
      <div class="stat-label">${c.label}</div>
      <div class="stat-value" style="color:${c.clr}">${c.val}</div>
      ${c.delta ? `<div class="stat-delta ${c.deltaClr || ''}">${c.delta}</div>` : ''}
    </div>`).join('');
}

/* ════════════════════════════════════════
   RENDER — TICKET LIST
════════════════════════════════════════ */
function renderList() {
  const filtered = getFiltered();
  const totalP   = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  if (state.page > totalP) state.page = 1;
  const paged    = filtered.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);

  const countEl = document.getElementById('resultCount');
  if (countEl) countEl.textContent = `${filtered.length} tickets`;

  const listEl = document.getElementById('ticketList');
  if (!listEl) return;

  if (!paged.length) {
    listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">🎫</span><p>No tickets match your filters.</p></div>`;
  } else {
    listEl.innerHTML = paged.map((t, i) => {
      const urgent = isUrgent(t.subject);
      const subj   = urgent ? t.subject.replace(/\[urgent\]/i, '').trim() : t.subject;
      const clr    = statusColor(t.status);
      return `
        <div class="t-row${t.id === state.selectedId ? ' selected' : ''}"
             style="animation-delay:${Math.min(i, 10) * .03}s;--bar-clr:${clr}"
             onclick="openDetail(${t.id})">
          <div class="t-left-bar"></div>
          <div class="t-inner">
            <div class="t-header">
              <span class="t-subject">${urgent ? '<span class="urgent-pill">⚡ URGENT</span> ' : ''}${escHtml(subj)}</span>
              <span class="t-id">#${t.id}</span>
            </div>
            <div class="t-footer">
              <span class="status-badge s-${t.status}">${t.status.replace('_', ' ')}</span>
              ${t.tags.map(g => `<span class="cat-tag">${escHtml(g)}</span>`).join('')}
              <span class="t-meta">
                <span class="t-replies">
                  <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  ${t.replies}
                </span>
                ${escHtml(t.user.split('.')[0])} · ${t.updated || '—'}
              </span>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  renderPager(filtered.length, totalP);
}

function renderPager(total, totalP) {
  const pagerEl = document.getElementById('pager');
  if (!pagerEl) return;
  if (totalP <= 1) { pagerEl.innerHTML = ''; return; }

  const btns = [];
  btns.push(`<button class="p-btn" onclick="goPage(${state.page - 1})" ${state.page === 1 ? 'disabled' : ''}>‹</button>`);
  for (let i = 1; i <= totalP; i++) {
    if (totalP <= 7 || i === 1 || i === totalP || Math.abs(i - state.page) <= 1) {
      btns.push(`<button class="p-btn${i === state.page ? ' cur' : ''}" onclick="goPage(${i})">${i}</button>`);
    } else if (Math.abs(i - state.page) === 2) {
      btns.push(`<span style="padding:4px;color:var(--t4);font-size:11px">…</span>`);
    }
  }
  btns.push(`<button class="p-btn" onclick="goPage(${state.page + 1})" ${state.page === totalP ? 'disabled' : ''}>›</button>`);
  pagerEl.innerHTML = `
    <span class="pager-info">${total} results · page ${state.page}/${totalP}</span>
    <div class="pager-btns">${btns.join('')}</div>`;
}

/* ════════════════════════════════════════
   RENDER — RIGHT SIDEBAR CARDS
════════════════════════════════════════ */
function renderSidebar() {
  const el = document.getElementById('rightPanel');
  if (!el || !state.stats) return;
  const { byCat, byMonth, topUsers, total } = state.stats;

  // ── Monthly trend bars ──
  const maxM = Math.max(...byMonth.map(([,, c]) => c), 1);
  const trendColors = ['#00d4aa','#00d4aa','#00d4aa','#00d4aa','#00d4aa',
                       '#00d4aa','#4f94f8','#4f94f8','#f0883e','#f0883e'];
  const trendBars = byMonth.map(([lbl, full, c], i) => {
    const h = Math.max(3, Math.round((c / maxM) * 52));
    return `
      <div class="trend-col" title="${escHtml(full)}: ${c}">
        <div class="trend-bar-bg">
          <div class="trend-bar" style="height:${h}px;background:${trendColors[i] || '#4f94f8'};opacity:.75;transition:height .5s ${i * .06}s ease"></div>
        </div>
        <div class="trend-lbl">${lbl}</div>
      </div>`;
  }).join('');

  // ── Category bars ──
  const maxC = byCat[0]?.[1] || 1;
  const catBars = byCat.slice(0, 8).map(([name, cnt], i) => `
    <div class="cat-bar-row" style="animation-delay:${i * .05}s">
      <span class="cat-bar-label" title="${escHtml(name)}">${escHtml(name)}</span>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${Math.round(cnt / maxC * 100)}%"></div>
      </div>
      <span class="cat-bar-count">${cnt}</span>
    </div>`).join('');

  // ── Top users ──
  const userRows = topUsers.map(([name, cnt, col]) => `
    <div class="user-row">
      <div class="u-avatar-sm" style="background:${col}20;color:${col}">${initials(name)}</div>
      <span class="u-name-sm" title="${escHtml(name)}">${escHtml(name)}</span>
      <span class="u-cnt-sm">${cnt}</span>
    </div>`).join('');

  const dateRange = byMonth.length >= 2
    ? `${byMonth[0][1]} – ${byMonth.at(-1)[1]}`
    : 'All time';

  el.innerHTML = `
    <div class="r-card">
      <div class="r-card-head">
        <span class="r-card-title">Monthly Volume</span>
        <span class="r-card-sub">${escHtml(dateRange)}</span>
      </div>
      <div class="r-card-body"><div class="trend-wrap">${trendBars}</div></div>
    </div>
    <div class="r-card">
      <div class="r-card-head">
        <span class="r-card-title">By Category</span>
        <span class="r-card-sub">${total} total</span>
      </div>
      <div class="r-card-body">${catBars}</div>
    </div>
    <div class="r-card">
      <div class="r-card-head">
        <span class="r-card-title">Top Requesters</span>
        <span class="r-card-sub">all time</span>
      </div>
      <div class="r-card-body">${userRows}</div>
    </div>`;
}

/* ════════════════════════════════════════
   DETAIL DRAWER
════════════════════════════════════════ */
function openDetail(id) {
  state.selectedId = id;
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  const urgent = isUrgent(t.subject);
  const subj   = urgent ? t.subject.replace(/\[urgent\]/i, '').trim() : t.subject;

  document.getElementById('drawerBody').innerHTML = `
    <div class="drawer-status-row">
      <span class="status-badge s-${t.status}">${t.status.replace('_', ' ')}</span>
      ${urgent ? '<span class="urgent-pill">⚡ URGENT</span>' : ''}
      ${t.tags.map(g => `<span class="cat-tag">${escHtml(g)}</span>`).join('')}
    </div>
    <div class="drawer-subject">${escHtml(subj)}</div>
    <div class="drawer-meta-grid">
      <span class="dm-key">ticket_id</span><span class="dm-val mono">#${t.id}</span>
      <span class="dm-key">requester</span><span class="dm-val">${escHtml(t.user)}</span>
      <span class="dm-key">created</span><span class="dm-val mono">${t.created || '—'}</span>
      <span class="dm-key">updated</span><span class="dm-val mono">${t.updated || '—'}</span>
      ${t.closed ? `<span class="dm-key">resolved</span><span class="dm-val mono">${t.closed}</span>` : ''}
      <span class="dm-key">replies</span><span class="dm-val mono">${t.replies}</span>
    </div>
    ${t.preview ? `
    <div class="reply-box">
      <div class="reply-label">Latest Reply</div>
      <div class="reply-text">${escHtml(t.preview)}</div>
      <div class="reply-date">${t.updated || '—'}</div>
    </div>` : ''}`;

  document.getElementById('detail-overlay').classList.add('show');
  renderList(); // highlight selected row
}

function closeDetail(e) {
  if (e && e.target !== document.getElementById('detail-overlay')) return;
  document.getElementById('detail-overlay').classList.remove('show');
  state.selectedId = null;
  renderList();
}

/* ════════════════════════════════════════
   MOBILE SIDEBAR
════════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mob-sidebar-overlay').classList.toggle('show');
}

/* ════════════════════════════════════════
   CATEGORY SELECT POPULATION
════════════════════════════════════════ */
function populateCatSelect() {
  const sel = document.getElementById('catSel');
  if (!sel || !state.stats) return;
  // Remove existing dynamic options
  while (sel.options.length > 1) sel.remove(1);
  for (const [name] of state.stats.byCat) {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  }
}

function updateNavBadges() {
  if (!state.stats) return;
  const { byStatus } = state.stats;
  const openEl = document.getElementById('nav-open');
  const progEl = document.getElementById('nav-progress');
  if (openEl) openEl.textContent = byStatus.open || 0;
  if (progEl) progEl.textContent = byStatus.in_progress || 0;
}

/* ════════════════════════════════════════
   MAIN RENDER ORCHESTRATOR
════════════════════════════════════════ */
function render() {
  renderStats();
  renderList();
  renderSidebar();
}

/* ════════════════════════════════════════
   KEYBOARD SHORTCUT
════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetail({ target: document.getElementById('detail-overlay') });
  }
  // Ctrl/Cmd+K → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchQ')?.focus();
  }
});

/* ════════════════════════════════════════
   BOOTSTRAP
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', init);
