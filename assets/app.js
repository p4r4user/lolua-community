/* LoL UA Community — player guide site.
   No build step, no dependencies. Sections:
   1. language   2. numbers   3. pins   4. guild gates   5. level calculator
   6. chest tabs   7. search   8. nav highlight   9. endless ribbon
   10. easter egg + the hidden mini-game */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ── 1. language ─────────────────────────────────────────────── */
  var LANGS = ['uk', 'en'];
  var TITLES = {
    uk: 'LoL UA Community — довідник гравця',
    en: 'LoL UA Community — player guide'
  };
  var STORE_KEY = 'lolua_faq_lang';

  function storeGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function storeSet(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* private mode */ } }

  function detectLang() {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (LANGS.indexOf(q) !== -1) return q;
    var saved = storeGet(STORE_KEY);
    if (LANGS.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || 'uk').toLowerCase();
    return nav.indexOf('en') === 0 ? 'en' : 'uk';
  }

  function lang() { return root.dataset.lang === 'en' ? 'en' : 'uk'; }
  function t(uk, en) { return lang() === 'en' ? en : uk; }

  function setLang(l, persist) {
    root.dataset.lang = l;
    root.lang = l;
    document.title = TITLES[l];
    $$('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.setLang === l));
    });
    var search = $('#search');
    if (search) search.placeholder = search.getAttribute('data-ph-' + l) || '';
    $$('[data-alt-' + l + ']').forEach(function (img) { img.alt = img.getAttribute('data-alt-' + l); });
    if (persist) storeSet(STORE_KEY, l);
    formatNumbers();
    document.dispatchEvent(new CustomEvent('langchange'));
  }

  $$('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.dataset.setLang, true); });
  });

  /* ── 2. numbers (15 000 in Ukrainian, 15,000 in English) ─────── */
  function fmt(n) { return new Intl.NumberFormat(lang() === 'en' ? 'en-US' : 'uk-UA').format(n); }
  function formatNumbers() {
    $$('.n[data-n]').forEach(function (el) { el.textContent = fmt(Number(el.dataset.n)); });
  }

  /* ── 3. pins ↔ legend ────────────────────────────────────────── */
  function toggleGroup(id, on) {
    $$('[data-pin="' + id + '"]').forEach(function (el) { el.classList.toggle('on', on); });
  }
  $$('.legend li[data-pin], .pin[data-pin]').forEach(function (el) {
    var id = el.dataset.pin;
    if (el.tagName === 'LI') el.tabIndex = 0;
    ['mouseenter', 'focus'].forEach(function (ev) { el.addEventListener(ev, function () { toggleGroup(id, true); }); });
    ['mouseleave', 'blur'].forEach(function (ev) { el.addEventListener(ev, function () { toggleGroup(id, false); }); });
  });

  /* ── 4. guild level thresholds (same formula as the bot) ─────── */
  function guildGate(level) {
    return level <= 1 ? 0 : Math.round(4400 * Math.pow(level - 1, 1.635) / 500) * 500;
  }
  var GATE_LEVELS = [2, 5, 10, 15, 20, 25, 30];

  function renderGates() {
    var box = $('#gateBars');
    if (!box) return;
    var max = guildGate(30);
    box.innerHTML = '';
    GATE_LEVELS.forEach(function (lv) {
      var xp = guildGate(lv);
      var row = document.createElement('div');
      row.className = 'odd';
      row.innerHTML =
        '<span>' + t('Рівень ', 'Level ') + '<b>' + lv + '</b></span>' +
        '<span class="p">' + fmt(xp) + ' XP</span>' +
        '<div class="bar"><i style="--w:' + Math.max(1.2, (xp / max) * 100).toFixed(1) + '%;--c:var(--gold)"></i></div>';
      box.appendChild(row);
    });
  }

  /* ── 5. level calculator ─────────────────────────────────────── */
  var SLOPE = 140, BASE = 3400, MAX_LEVEL = 100;
  function totalXp(n) { return n <= 0 ? 0 : SLOPE * (n - 1) * n / 2 + BASE * n; }

  // [level, gem role, tier, emoji, colour] — mirrors the bot's tier roles.
  var TIERS = [
    [5, 'Obsidian', 'Legacy', '📦', '#9eaae6'],
    [10, 'Aquamarine', 'Epic', '💜', '#7df0d0'],
    [25, 'Ruby', 'Legendary', '🧡', '#ff5f7e'],
    [35, 'Amethyst', 'Mythic', '🔱', '#bb8cff'],
    [45, 'Citrine', 'Ultimate', '🌟', '#ffd24d'],
    [60, 'Turquoise', 'Exalted', '👑', '#3fcbea'],
    [75, 'Quartz', 'Transcendent', '🌌', '#ffb8dc'],
    [100, 'Exclusive', 'Exclusive', '💎', '#ffffff']
  ];
  var XP_PER_HOUR = 1500;   // 75 average XP per 3-minute voice tick
  var HOURS_PER_DAY = 2;

  var slider = $('#lvl');
  var svg = $('#xpChart');
  var CH = { w: 900, h: 260, l: 62, r: 16, t: 14, b: 26 };
  var NS = 'http://www.w3.org/2000/svg';
  function node(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  var chartX = function (lv) { return CH.l + (lv / MAX_LEVEL) * (CH.w - CH.l - CH.r); };
  var chartY = function (xp) { return CH.t + (1 - xp / totalXp(MAX_LEVEL)) * (CH.h - CH.t - CH.b); };
  var cursor = {};

  function buildChart() {
    if (!svg) return;
    var defs = node('defs');
    var grad = node('linearGradient', { id: 'xpFill', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(node('stop', { offset: '0%', 'stop-color': '#ffcc4d', 'stop-opacity': '.45' }));
    grad.appendChild(node('stop', { offset: '100%', 'stop-color': '#ffcc4d', 'stop-opacity': '0' }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    [0, 250000, 500000, 750000, 1000000].forEach(function (v) {
      var y = chartY(v);
      svg.appendChild(node('line', { x1: CH.l, x2: CH.w - CH.r, y1: y, y2: y, stroke: 'rgba(255,255,255,.14)' }));
      var tx = node('text', { x: CH.l - 8, y: y + 4, 'text-anchor': 'end', fill: '#9aa5d6', 'font-size': 11, 'font-family': 'JetBrains Mono, monospace' });
      tx.textContent = v === 0 ? '0' : (v / 1000) + 'k';
      svg.appendChild(tx);
    });

    var pts = [];
    for (var n = 0; n <= MAX_LEVEL; n++) pts.push(chartX(n).toFixed(1) + ',' + chartY(totalXp(n)).toFixed(1));
    var base = chartY(0);
    svg.appendChild(node('path', { d: 'M' + pts.join(' L') + ' L' + chartX(MAX_LEVEL) + ',' + base + ' L' + chartX(0) + ',' + base + ' Z', fill: 'url(#xpFill)' }));
    svg.appendChild(node('path', { d: 'M' + pts.join(' L'), fill: 'none', stroke: '#ffcc4d', 'stroke-width': 3, 'stroke-linejoin': 'round' }));

    TIERS.forEach(function (tr) {
      svg.appendChild(node('circle', { cx: chartX(tr[0]), cy: chartY(totalXp(tr[0])), r: 4.5, fill: tr[4], stroke: '#1a2145', 'stroke-width': 1.5 }));
    });

    cursor.line = node('line', { y1: CH.t, y2: base, stroke: '#fff', 'stroke-width': 1.5, 'stroke-dasharray': '4 4', opacity: .7 });
    cursor.dot = node('circle', { r: 7, fill: '#fff', stroke: '#ff74b1', 'stroke-width': 3 });
    svg.appendChild(cursor.line);
    svg.appendChild(cursor.dot);

    var tx2 = node('text', { x: CH.l, y: CH.h - 6, fill: '#9aa5d6', 'font-size': 11, 'font-family': 'JetBrains Mono, monospace' });
    tx2.textContent = '1';
    svg.appendChild(tx2);
    var tx3 = node('text', { x: CH.w - CH.r, y: CH.h - 6, 'text-anchor': 'end', fill: '#9aa5d6', 'font-size': 11, 'font-family': 'JetBrains Mono, monospace' });
    tx3.textContent = '100';
    svg.appendChild(tx3);
  }

  function updateCalc() {
    if (!slider) return;
    var n = Number(slider.value);
    var xp = totalXp(n);
    var hours = xp / XP_PER_HOUR;
    var cur = null;
    TIERS.forEach(function (tr) { if (n >= tr[0]) cur = tr; });

    $('#lvOut').textContent = n;
    $('#rdXp').textContent = fmt(xp);
    $('#rdHours').textContent = fmt(Math.round(hours));
    $('#rdDays').textContent = fmt(Math.max(1, Math.round(hours / HOURS_PER_DAY)));
    $('#rdGold').textContent = fmt(50 * n * (n + 1) / 2);

    var tierBox = $('#lvTier');
    if (cur) {
      tierBox.innerHTML = '<span style="color:' + cur[4] + '">' + cur[1] + '</span>';
    } else {
      tierBox.innerHTML = '<span style="color:var(--ink-faint)">' + t('Без ролі (до 5 рівня)', 'No role yet (below level 5)') + '</span>';
    }
    $$('#tiers .tier').forEach(function (el) {
      el.classList.toggle('cur', !!cur && Number(el.dataset.lv) === cur[0]);
    });
    if (cursor.line) {
      var x = chartX(n), y = chartY(xp);
      cursor.line.setAttribute('x1', x); cursor.line.setAttribute('x2', x);
      cursor.dot.setAttribute('cx', x); cursor.dot.setAttribute('cy', y);
    }
  }
  if (slider) {
    buildChart();
    slider.addEventListener('input', updateCalc);
  }

  /* ── 6. chest tabs ───────────────────────────────────────────── */
  $$('.tabs [data-chest]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.dataset.chest;
      $$('.tabs [data-chest]').forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
      $$('[data-chestpanel]').forEach(function (p) { p.hidden = p.dataset.chestpanel !== id; });
    });
  });

  /* ── 7. search (matches both languages whatever is shown) ────── */
  var search = $('#search');
  if (search) {
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      $$('[data-item]').forEach(function (el) {
        var hit = !q || el.textContent.toLowerCase().indexOf(q) !== -1;
        el.hidden = !hit;
        if (hit) shown++;
        if (hit && q && el.tagName === 'DETAILS') el.open = true;
        if (!q && el.tagName === 'DETAILS') el.open = false;
      });
      $('#noResults').classList.toggle('show', shown === 0);
    });
  }

  /* ── 8. nav highlight ────────────────────────────────────────── */
  if ('IntersectionObserver' in window) {
    var links = {};
    $$('nav.menu a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.toggle('on', k === en.target.id); });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  var brandBtn = $('#brand');   // logo: scroll to top (+ one of the easter-egg triggers below)
  if (brandBtn) brandBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ── 9. endless ribbon ───────────────────────────────────────── */
  // The track is two identical halves and the animation moves it by exactly one half,
  // so it loops seamlessly — but only if a half is at least as wide as the screen,
  // otherwise a gap shows at the right edge on wide monitors. So: repeat the group
  // inside each half until that holds, and re-measure on resize / font load / language.
  var track = $('.ribbon-track');
  if (track) {
    var halves = $$('.ribbon-half', track);
    var unit = halves[0].innerHTML;
    var PX_PER_SEC = 70;
    var buildRibbon = function () {
      halves.forEach(function (h) { h.innerHTML = unit; });
      var one = halves[0].getBoundingClientRect().width;
      if (!one) return;
      var copies = Math.max(1, Math.ceil(window.innerWidth / one));
      var html = new Array(copies + 1).join(unit);
      halves.forEach(function (h) { h.innerHTML = html; });
      track.style.animationDuration = Math.max(12, (one * copies) / PX_PER_SEC) + 's';
    };
    var ribbonTimer;
    window.addEventListener('resize', function () { clearTimeout(ribbonTimer); ribbonTimer = setTimeout(buildRibbon, 150); });
    document.addEventListener('langchange', buildRibbon);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildRibbon);
    buildRibbon();
  }

  /* ── 10. easter egg: the hidden "Poro Vault" game ────────────── */
  // Section 05 is a public "coming soon" card; this hidden section is the separate easter egg.
  var egg = $('#egg');

  function revealEgg() {
    if (!egg) return;
    egg.hidden = false;
    egg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (egg) {
    // (a) the little egg in the footer
    var seed = $('#egg-seed');
    if (seed) seed.addEventListener('click', revealEgg);
    // (b) five quick clicks on the logo
    var clicks = [];
    if (brandBtn) brandBtn.addEventListener('click', function () {
      var now = Date.now();
      clicks = clicks.filter(function (c) { return now - c < 3500; });
      clicks.push(now);
      if (clicks.length >= 5) { clicks = []; revealEgg(); }
    });
    // (c) the Konami code
    var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    var seq = [];
    document.addEventListener('keydown', function (e) {
      seq.push((e.key || '').toLowerCase());
      seq = seq.slice(-KONAMI.length);
      if (seq.join() === KONAMI.join()) { seq = []; revealEgg(); }
    });
    // (d) a direct link
    if (window.location.hash === '#egg') egg.hidden = false;
  }

  /* ── mini-game: catch the gold ───────────────────────────────── */
  var cv = $('#game');
  if (cv) {
    var W = 720, H = 420, DURATION = 60;
    var SPEED = 2;   // fall-speed multiplier — 1 was the previous pace
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var BEST_KEY = 'lolua_faq_egg_best';
    var KINDS = {
      coin:    { emoji: '🪙', size: 32, weight: 52 },
      crystal: { emoji: '💎', size: 36, weight: 16 },
      gift:    { emoji: '🎁', size: 38, weight: 4 },
      shroom:  { emoji: '🍄', size: 36, weight: 28 }
    };
    var KIND_LIST = Object.keys(KINDS);
    var FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

    var g = { running: false, items: [], floats: [], gold: 0, cry: 0, combo: 0, time: DURATION, spawn: 0, last: 0, elapsed: 0 };
    var el = {
      gold: $('#hGold'), cry: $('#hCry'), time: $('#hTime'), combo: $('#hCombo'), best: $('#hBest'),
      start: $('#ovStart'), end: $('#ovEnd'), title: $('#endTitle'), line: $('#endLine')
    };
    var best = Number(storeGet(BEST_KEY)) || 0;
    el.best.textContent = fmt(best);
    document.addEventListener('langchange', function () { el.best.textContent = fmt(best); });

    var multiplier = function () { return Math.min(3, 1 + Math.floor(g.combo / 6) * 0.5); };

    function pickKind() {
      var total = KIND_LIST.reduce(function (s, k) { return s + KINDS[k].weight; }, 0);
      var r = Math.random() * total;
      for (var i = 0; i < KIND_LIST.length; i++) {
        r -= KINDS[KIND_LIST[i]].weight;
        if (r <= 0) return KIND_LIST[i];
      }
      return 'coin';
    }

    function spawnItem() {
      var kind = pickKind(), def = KINDS[kind];
      // Everything gets harder with progress: faster, smaller, wobblier.
      var prog = g.elapsed / DURATION;
      var size = def.size * (1 - 0.3 * prog);
      g.items.push({
        kind: kind, size: size, x: 36 + Math.random() * (W - 72), y: -size,
        vy: SPEED * (110 + Math.random() * 110) * (1 + 1.3 * prog), phase: Math.random() * 6.28,
        sway: 14 + Math.random() * 40 + 30 * prog
      });
    }

    function floatText(x, y, text, color) { g.floats.push({ x: x, y: y, text: text, color: color, life: 0.9 }); }

    function reset() {
      g.items = []; g.floats = []; g.gold = 0; g.cry = 0; g.combo = 0;
      g.time = DURATION; g.spawn = 0; g.elapsed = 0;
    }

    function startGame() {
      reset();
      g.running = true;
      el.start.hidden = true; el.end.hidden = true;
      g.last = performance.now();
      requestAnimationFrame(frame);
    }

    function endGame() {
      g.running = false;
      var score = g.gold + g.cry * 50;
      var fresh = score > best;
      if (fresh) { best = score; storeSet(BEST_KEY, String(best)); el.best.textContent = fmt(best); }
      var ranks = [
        [400, 'Новачок Поро', 'Poro rookie'], [1000, 'Збирач монет', 'Coin collector'],
        [1800, 'Шукач скарбів', 'Treasure hunter'], [Infinity, 'Легенда Bandle City', 'Bandle City legend']
      ];
      var rank = ranks.filter(function (r) { return score < r[0]; })[0];
      el.title.textContent = '🏅 ' + t(rank[1], rank[2]);
      el.line.textContent = '🪙 ' + fmt(g.gold) + '  ·  💎 ' + fmt(g.cry) + '  ·  ' + t('рахунок ', 'score ') + fmt(score) +
        (fresh ? '  ·  🎉 ' + t('новий рекорд!', 'new best!') : '');
      el.end.hidden = false;
    }

    function hud() {
      el.gold.textContent = fmt(g.gold);
      el.cry.textContent = fmt(g.cry);
      el.time.textContent = String(Math.max(0, Math.ceil(g.time)));
      el.time.parentNode.classList.toggle('low', g.time <= 10);
      el.combo.textContent = String(multiplier()).replace('.', lang() === 'en' ? '.' : ',');
    }

    function catchItem(it) {
      var m = multiplier();
      if (it.kind === 'shroom') {
        g.gold = Math.max(0, g.gold - 30); g.combo = 0;
        floatText(it.x, it.y, '−30', '#ff7a7a');
      } else if (it.kind === 'coin') {
        var add = Math.round(10 * m); g.gold += add; g.combo++;
        floatText(it.x, it.y, '+' + add, '#ffcc4d');
      } else if (it.kind === 'crystal') {
        g.cry += 1; g.combo++;
        floatText(it.x, it.y, '+1 💎', '#93e9ff');
      } else {
        var bonus = Math.round(50 * m); g.gold += bonus; g.cry += 2; g.combo++;
        floatText(it.x, it.y, '+' + bonus + ' / +2 💎', '#ae92ff');
      }
    }

    cv.addEventListener('pointerdown', function (e) {
      if (!g.running) return;
      e.preventDefault();
      var r = cv.getBoundingClientRect();
      var x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
      for (var i = g.items.length - 1; i >= 0; i--) {   // topmost first
        var it = g.items[i];
        var dx = x - it.x, dy = y - it.y;
        if (dx * dx + dy * dy <= Math.pow(it.size * 0.7 + 4, 2)) {
          g.items.splice(i, 1);
          catchItem(it);
          hud();
          return;
        }
      }
      // A click at nothing is a miss: it costs gold and the streak, so
      // mashing the whole canvas no longer wins.
      g.gold = Math.max(0, g.gold - 5); g.combo = 0;
      floatText(x, y, '−5', '#ff7a7a');
      hud();
    });

    function frame(now) {
      if (!g.running) return;
      var dt = Math.min(0.05, (now - g.last) / 1000);   // a hidden tab must not skip the clock
      g.last = now;
      g.time -= dt; g.elapsed += dt;
      if (g.time <= 0) { g.time = 0; hud(); draw(); endGame(); return; }

      g.spawn -= dt;
      if (g.spawn <= 0) { spawnItem(); g.spawn = 0.62 - 0.4 * (g.elapsed / DURATION) + Math.random() * 0.1; }

      for (var i = g.items.length - 1; i >= 0; i--) {
        var it = g.items[i];
        it.y += it.vy * dt;
        it.x += Math.sin(g.elapsed * 2 + it.phase) * it.sway * dt;
        if (it.y > H + it.size) {
          if (it.kind !== 'shroom') g.combo = 0;        // a missed treasure breaks the streak
          g.items.splice(i, 1);
        }
      }
      for (var j = g.floats.length - 1; j >= 0; j--) {
        var f = g.floats[j];
        f.life -= dt; f.y -= 46 * dt;
        if (f.life <= 0) g.floats.splice(j, 1);
      }
      hud();
      draw();
      requestAnimationFrame(frame);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2c3680'); sky.addColorStop(1, '#171d44');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // a few static stars
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (var s = 0; s < 36; s++) ctx.fillRect((s * 97) % W, (s * 53) % (H - 40), 2, 2);
      // ground
      ctx.fillStyle = 'rgba(255,204,77,.18)'; ctx.fillRect(0, H - 10, W, 10);

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      g.items.forEach(function (it) {
        if (it.kind === 'crystal' || it.kind === 'gift') {
          var glow = ctx.createRadialGradient(it.x, it.y, 2, it.x, it.y, it.size);
          glow.addColorStop(0, it.kind === 'gift' ? 'rgba(174,146,255,.55)' : 'rgba(147,233,255,.5)');
          glow.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, 6.283); ctx.fill();
        }
        ctx.font = it.size + 'px ' + FONT;
        ctx.fillText(KINDS[it.kind].emoji, it.x, it.y);
      });
      ctx.font = '700 20px "JetBrains Mono", monospace';
      g.floats.forEach(function (f) {
        ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.5));
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - 26);
      });
      ctx.globalAlpha = 1;
    }

    $('#btnStart').addEventListener('click', startGame);
    $('#btnAgain').addEventListener('click', startGame);
    hud(); draw();
  }


  /* ── mobile menu ─────────────────────────────────────────────── */
  var burger = $('#burger'), menu = $('#menu');
  if (burger && menu) {
    var setMenu = function (open) {
      menu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    };
    burger.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ── text and images are not selectable / draggable ──────────── */
  // CSS (user-select / pointer-events) does the work; these block the
  // remaining routes. Inputs stay usable. This discourages casual copying
  // only — it is not protection.
  var isField = function (t) { return t && t.closest && t.closest('input, textarea'); };
  document.addEventListener('selectstart', function (e) { if (!isField(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });
  document.addEventListener('copy', function (e) { if (!isField(e.target)) e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) {
    if (!isField(e.target) && e.target.closest && e.target.closest('img, .shot, .banner, .th, .hero-logo, .brand')) e.preventDefault();
  });

  /* ── boot ────────────────────────────────────────────────────── */
  document.addEventListener('langchange', function () { renderGates(); updateCalc(); });
  setLang(detectLang(), false);
}());
