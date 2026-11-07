/*
 * Swarm intro effect (original implementation).
 * Elements marked data-swarm start hidden. As they scroll into view, a "swarm" of
 * cursors flies to each one, drags out a selection box with a size badge, then the
 * element appears (headings marked data-swarm="type" are typed out).
 * Disable with ?nofx in the URL or prefers-reduced-motion.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var targets = [].slice.call(document.querySelectorAll('[data-swarm]'));

  // Copy-email button works regardless of the effect.
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var done = function () { var o = b.textContent; b.textContent = 'Copied!'; setTimeout(function () { b.textContent = o; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
    });
  });

  if (reduce || params.has('nofx') || !targets.length) { root.classList.add('swarm-off'); return; }

  var COLORS = ['#ff3b3b', '#4cc9f0', '#f9c74f', '#90be6d', '#c77dff', '#ff9f1c'];
  var NAMES = ['ava', 'kai', 'mira', 'zed', 'noor', 'leo'];
  var speed = 1;
  var skipped = false;
  var built = 0;
  var queue = [];
  var pumping = false;

  root.classList.add('swarm-on');

  var layer = document.createElement('div');
  layer.className = 'swarm-layer';
  document.body.appendChild(layer);

  // ---- controls ----
  var bar = document.createElement('div');
  bar.className = 'swarm-bar';
  bar.innerHTML = '<span class="count">building 0/' + targets.length + '</span><span class="prog"><i></i></span>' +
    '<button type="button" data-a="speed">1x</button><button type="button" data-a="replay">Replay</button><button type="button" data-a="skip">Skip</button>';
  document.body.appendChild(bar);
  var countEl = bar.querySelector('.count');
  var progEl = bar.querySelector('.prog i');

  function updateBar() {
    countEl.textContent = (built >= targets.length ? 'built ' : 'building ') + built + '/' + targets.length;
    progEl.style.width = (built / targets.length * 100) + '%';
  }

  // ---- cursors ----
  var cursors = COLORS.map(function (color, i) {
    var el = document.createElement('div');
    el.className = 'swarm-cursor';
    el.innerHTML = '<svg width="16" height="20" viewBox="0 0 16 20"><path d="M1 1l13 8.5-5.6 1.4L5.6 17z" fill="' + color + '" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg><em style="background:' + color + '">' + NAMES[i] + '</em>';
    var c = { el: el, x: Math.random() * innerWidth, y: -40, busy: false };
    el.style.transform = 'translate(' + c.x + 'px,' + c.y + 'px)';
    layer.appendChild(el);
    return c;
  });

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms / speed); }); }

  function moveTo(c, x, y, ms) {
    c.x = x; c.y = y;
    c.el.style.transitionDuration = (ms / speed) + 'ms';
    c.el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    return sleep(ms);
  }

  function clampX(x) { return Math.max(4, Math.min(innerWidth - 20, x)); }
  function clampY(y) { return Math.max(4, Math.min(innerHeight - 24, y)); }

  // ---- typing ----
  function collectText(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push({ node: n, full: n.nodeValue });
    return nodes;
  }

  async function typeInto(el, ms) {
    var parts = collectText(el);
    var total = parts.reduce(function (s, p) { return s + p.full.length; }, 0);
    if (!total) return;
    var h = el.getBoundingClientRect().height;
    el.style.minHeight = h + 'px';
    parts.forEach(function (p) { p.node.nodeValue = ''; });
    el.classList.add('swarm-caret');
    var step = Math.max(12, ms / total);
    for (var i = 0; i < parts.length && !skipped; i++) {
      var full = parts[i].full;
      for (var j = 1; j <= full.length && !skipped; j++) {
        parts[i].node.nodeValue = full.slice(0, j);
        await sleep(step);
      }
    }
    el.classList.remove('swarm-caret');
    el.style.minHeight = '';
    if (skipped) restore(el);
  }

  function restore(el) {
    if (el._orig != null) el.innerHTML = el._orig;
    el.classList.remove('swarm-caret');
    el.style.minHeight = '';
  }

  // Boxed things (cards, images, rows) use their own rect; plain text blocks
  // use the width of their actual content so the selection hugs the text.
  function targetRect(el) {
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    var boxed = el.tagName === 'IMG' || parseFloat(cs.borderTopWidth) > 0 ||
      (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)');
    if (boxed) return r;
    var range = document.createRange();
    range.selectNodeContents(el);
    var cr = range.getBoundingClientRect();
    if (!cr.width || !cr.height) return r;
    return { left: cr.left, top: cr.top, right: cr.right, bottom: cr.bottom, width: cr.width, height: cr.height };
  }

  // ---- build one element ----
  async function build(el, c) {
    var r = targetRect(el);
    if (!r.width || !r.height) { reveal(el); return; }

    var x0 = clampX(r.left), y0 = clampY(r.top);
    var x1 = clampX(r.right - 6), y1 = clampY(r.bottom - 6);
    var travel = 500 + Math.random() * 300;
    var drag = Math.min(900, 380 + r.width * 0.5);

    await moveTo(c, x0, y0, travel);
    if (skipped) return;

    var box = document.createElement('div');
    box.className = 'swarm-box';
    box.style.left = x0 + 'px';
    box.style.top = y0 + 'px';
    box.innerHTML = '<i></i><i></i><i></i><i></i><b></b>';
    layer.appendChild(box);
    var badge = box.querySelector('b');

    var bw = Math.max(2, x1 - x0), bh = Math.max(2, y1 - y0);
    var t0 = performance.now();
    var dur = drag / speed;
    c.el.style.transitionDuration = dur + 'ms';
    c.el.style.transform = 'translate(' + x1 + 'px,' + y1 + 'px)';
    c.x = x1; c.y = y1;
    await new Promise(function (done) {
      (function frame() {
        var p = Math.max(0, Math.min(1, (performance.now() - t0) / dur));
        var e = 1 - Math.pow(1 - p, 3);
        box.style.width = (bw * e) + 'px';
        box.style.height = (bh * e) + 'px';
        badge.textContent = Math.round(r.width * e) + ' × ' + Math.round(r.height * e);
        if (p < 1 && !skipped) requestAnimationFrame(frame); else done();
      })();
    });
    if (skipped) { box.remove(); return; }

    if (el.getAttribute('data-swarm') === 'type') {
      el.classList.add('swarm-in');
      await typeInto(el, 700);
    } else {
      reveal(el);
      await sleep(250);
    }
    box.remove();
    built++; updateBar();

    // drift away a little so cursors look alive
    moveTo(c, clampX(c.x + (Math.random() * 160 - 80)), clampY(c.y + (Math.random() * 120 - 20)), 700);
  }

  function reveal(el) {
    el.classList.add('swarm-in');
    built++; updateBar();
  }

  // ---- queue / scheduler ----
  async function pump() {
    if (pumping) return;
    pumping = true;
    while (queue.length && !skipped) {
      var free = cursors.find(function (c) { return !c.busy; });
      if (!free) { await sleep(50); continue; }
      var el = queue.shift();
      if (el.classList.contains('swarm-in')) continue;
      free.busy = true;
      (function (el, c) {
        build(el, c).catch(function () { reveal(el); }).then(function () { c.busy = false; });
      })(el, free);
      await sleep(120);
    }
    pumping = false;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      queue.push(e.target);
    });
    queue.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
    pump();
  }, { threshold: 0.12 });

  function start() {
    targets.forEach(function (el) {
      if (el._orig == null && el.getAttribute('data-swarm') === 'type') el._orig = el.innerHTML;
      io.observe(el);
    });
  }

  function skip() {
    skipped = true;
    queue.length = 0;
    root.classList.remove('swarm-on');
    root.classList.add('swarm-off');
    targets.forEach(restore);
    targets.forEach(function (el) { el.classList.add('swarm-in'); });
    built = targets.length; updateBar();
  }

  function replay() {
    skipped = true;
    setTimeout(function () {
      skipped = false;
      queue.length = 0; built = 0; updateBar();
      cursors.forEach(function (c) { c.busy = false; });
      root.classList.remove('swarm-off');
      root.classList.add('swarm-on');
      targets.forEach(function (el) { restore(el); el.classList.remove('swarm-in'); });
      window.scrollTo({ top: 0, behavior: 'auto' });
      start();
    }, 150);
  }

  bar.addEventListener('click', function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a');
    if (a === 'skip') skip();
    else if (a === 'replay') replay();
    else if (a === 'speed') { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; e.target.textContent = speed + 'x'; }
  });

  // Failsafe: never leave visible content hidden if something stalls.
  setTimeout(function () {
    if (skipped) return;
    targets.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!el.classList.contains('swarm-in') && r.top < innerHeight && r.bottom > 0 && queue.indexOf(el) === -1 && !cursors.some(function (c) { return c.busy; })) {
        el.classList.add('swarm-in');
      }
    });
  }, 15000);

  start();
})();
