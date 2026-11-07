/*
 * Phase 2: 3D effects
 *  1. Hero background: a slowly rotating neural-network sphere (Three.js) that reacts to the mouse.
 *  2. 3D tilt on cards (pure CSS transforms, fine pointers only).
 * Disabled by prefers-reduced-motion or ?nofx. Fails silently if WebGL/Three.js is unavailable.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var off = reduce || new URLSearchParams(location.search).has('nofx');
  if (off) return;

  /* ---------- 1. hero network sphere ---------- */
  function initHero() {
    var canvas = document.getElementById('hero3d');
    if (!canvas || typeof THREE === 'undefined') return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 8.5;

    var group = new THREE.Group();
    scene.add(group);

    // Points spread evenly on a sphere (Fibonacci lattice), plus a small inner cluster.
    var N = 220, R = 2, pts = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2;
      var r = Math.sqrt(1 - y * y);
      var th = golden * i;
      pts.push(new THREE.Vector3(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R));
    }
    for (var k = 0; k < 40; k++) {
      var v = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5);
      pts.push(v.normalize().multiplyScalar(0.5 + Math.random() * 0.9));
    }

    var pos = new Float32Array(pts.length * 3);
    pts.forEach(function (p, i) { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; });
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xff3b3b, size: 3.2, sizeAttenuation: false, transparent: true, opacity: .95 })));

    // Connect close neighbours.
    var seg = [], maxD = 0.62;
    for (var a = 0; a < pts.length; a++) {
      for (var b = a + 1; b < pts.length; b++) {
        if (pts[a].distanceTo(pts[b]) < maxD) seg.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z);
      }
    }
    var lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3));
    group.add(new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: .22 })));

    // A faint outer ring for depth.
    var ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.006, 8, 160), new THREE.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: .35 }));
    ring.rotation.x = Math.PI / 2.4;
    group.add(ring);

    var mx = 0, my = 0, tx = 0, ty = 0;
    window.addEventListener('pointermove', function (e) {
      mx = (e.clientX / innerWidth - .5);
      my = (e.clientY / innerHeight - .5);
    }, { passive: true });

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      var wide = w / h > 1.15;
      group.position.x = wide ? 2.9 : 0;
      group.position.y = wide ? -0.2 : 1.6;
      var s = wide ? 1 : 0.8;
      group.scale.set(s, s, s);
      canvas.style.opacity = wide ? '' : '.45';
    }
    resize();
    window.addEventListener('resize', resize);

    var visible = true, raf = 0;
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(canvas.parentElement);

    function loop() {
      raf = 0;
      if (!visible) return;
      tx += (mx - tx) * 0.05;
      ty += (my - ty) * 0.05;
      group.rotation.y += 0.0025;
      group.rotation.x = ty * 0.6;
      group.rotation.z = tx * 0.25;
      ring.rotation.z += 0.004;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    canvas.classList.add('ready');
  }

  /* ---------- 2. 3D card tilt ---------- */
  function initTilt() {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('.card, .cert').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5;
        var py = (e.clientY - r.top) / r.height - .5;
        el.classList.add('tilting');
        el.style.transform = 'perspective(900px) rotateX(' + (-py * 7).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg) translateY(-4px)';
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('tilting');
        el.style.transform = '';
      });
    });
  }

  initHero();
  initTilt();
})();
