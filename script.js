/* ==========================================================
   Kids Heart Clinic — interactions
   ========================================================== */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ } },
  };

  const header = $("#header");
  const headerOffset = () => (header ? header.offsetHeight : 0) + 12;

  /* ---------- Lenis smooth scroll ---------- */
  let lenis = null;
  if (!reducedMotion && typeof window.Lenis === "function") {
    lenis = new Lenis({
      duration: 1.35,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
    });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    lenis.stop(); // stay still during the intro
  }

  function scrollToTarget(target) {
    if (lenis) {
      lenis.scrollTo(target, { offset: typeof target === "number" ? 0 : -headerOffset(), duration: 1.6 });
    } else if (typeof target === "number") {
      window.scrollTo({ top: target, behavior: reducedMotion ? "auto" : "smooth" });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset();
      window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    }
  }

  /* ---------- Intro ---------- */
  const intro = $("#intro");
  const heroTitle = $(".hero__title");
  let introDone = false;

  function endIntro() {
    if (introDone) return;
    introDone = true;
    intro?.classList.add("is-done");
    document.body.classList.remove("is-loading");
    lenis?.start();
    heroTitle?.classList.add("is-in");
    setTimeout(() => intro?.remove(), 1000);
  }
  const introStart = performance.now();
  const minIntro = reducedMotion ? 0 : 1700;
  window.addEventListener("load", () => {
    setTimeout(endIntro, Math.max(0, minIntro - (performance.now() - introStart)));
  });
  setTimeout(endIntro, 3200); // never keep a parent waiting on a slow image
  intro?.addEventListener("click", endIntro);

  /* ---------- Split hero title into words ---------- */
  if (heroTitle) {
    let i = 0;
    const parts = [];
    heroTitle.childNodes.forEach((node) => {
      const isEm = node.nodeName === "EM";
      node.textContent.split(/(\s+)/).forEach((word) => {
        if (!word) return;
        if (/^\s+$/.test(word)) { parts.push(" "); return; }
        const inner = isEm ? `<em>${word}</em>` : word;
        parts.push(`<span class="w"><span style="--i:${i++}">${inner}</span></span>`);
      });
    });
    heroTitle.setAttribute("aria-label", heroTitle.textContent.trim());
    heroTitle.innerHTML = parts.join("");
  }

  /* ---------- Floating hearts ---------- */
  const heartsBox = $("#floatingHearts");
  if (heartsBox && !reducedMotion) {
    const count = window.innerWidth < 720 ? 8 : 14;
    for (let n = 0; n < count; n++) {
      const h = document.createElement("span");
      h.className = "material-symbols-outlined fill";
      h.textContent = "favorite";
      const size = 10 + Math.random() * 18;
      const dur = 16 + Math.random() * 16;
      h.style.cssText = `left:${Math.random() * 100}%;font-size:${size}px;animation-duration:${dur}s;animation-delay:${-Math.random() * dur}s;--dx:${(Math.random() - 0.5) * 120}px;--rot:${(Math.random() - 0.5) * 60}deg;`;
      heartsBox.appendChild(h);
    }
  }

  /* ---------- Reveal on scroll ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add("is-in");
      if (el.classList.contains("reveal-stagger")) setTimeout(() => el.classList.add("is-settled"), 1500);
      if (el.matches(".stats")) runCounters(el);
      revealIO.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal, .reveal-stagger, .closing").forEach((el) => revealIO.observe(el));

  /* ---------- Count-up stats ---------- */
  function runCounters(root) {
    $$("[data-count]", root).forEach((el) => {
      const end = Number(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const dur = reducedMotion ? 0 : 1800;
      const t0 = performance.now();
      const tick = (now) => {
        const p = dur ? clamp((now - t0) / dur) : 1;
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(end * eased).toLocaleString("en-IN") + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- Live clinic status (IST) ---------- */
  const statusEl = $("#clinicStatus");
  function updateStatus() {
    if (!statusEl) return;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const day = now.getDay(); // 0 = Sunday
    const mins = now.getHours() * 60 + now.getMinutes();
    const open = 9 * 60, close = 17 * 60;
    let text, isOpen = false;
    if (day === 0) text = "Sunday: emergency on-call only · opens Monday, 9:00 AM";
    else if (mins < open) text = "Opens today at 9:00 AM";
    else if (mins < close) { isOpen = true; text = "Consulting now · open until 5:00 PM"; }
    else text = day === 6 ? "Closed for today · opens Monday, 9:00 AM" : "Closed for today · opens tomorrow, 9:00 AM";
    statusEl.classList.toggle("is-open", isOpen);
    $(".status__text", statusEl).textContent = text;
  }
  updateStatus();
  setInterval(updateStatus, 60_000);

  /* ---------- Mobile nav ---------- */
  const nav = $("#nav");
  const menuBtn = $("#menuBtn");
  function setMenu(open) {
    nav?.classList.toggle("is-open", open);
    menuBtn?.setAttribute("aria-expanded", String(open));
    menuBtn?.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  menuBtn?.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  document.addEventListener("click", (e) => {
    if (nav?.classList.contains("is-open") && !nav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
  });

  /* ---------- Anchor links ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id === "#") return;
      const target = id === "#top" ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      setMenu(false);
      if (a.dataset.consult) setConsultType(a.dataset.consult);
      scrollToTarget(target);
      if (id !== "#top") history.replaceState(null, "", id);
    });
  });

  /* ---------- Active nav link ---------- */
  const navLinks = $$(".nav a");
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = "#" + entry.target.id;
      navLinks.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$("main section[id]").forEach((s) => sectionIO.observe(s));

  /* ---------- Scroll-driven effects ---------- */
  const progressBar = $("#progressBar");
  const toTop = $("#toTop");
  const parallaxEls = $$("[data-parallax]");
  const timeline = $("#timeline");
  const timelineFill = $("#timelineFill");
  const tlItems = $$(".tl");
  const promise = $("#promiseText");
  let promiseWords = [];
  let lastY = 0;

  if (promise) {
    promise.innerHTML = promise.textContent.trim().split(/\s+/).map((w) => `<span class="pw">${w}</span>`).join(" ");
    promiseWords = $$(".pw", promise);
  }

  function onScroll(y) {
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    if (progressBar) progressBar.style.transform = `scaleX(${max > 0 ? clamp(y / max) : 0})`;

    // header: soft shadow once scrolled, tuck away when reading down
    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
      const goingDown = y > lastY + 2;
      const goingUp = y < lastY - 2;
      if (goingDown && y > 500 && !nav?.classList.contains("is-open")) header.classList.add("is-hidden");
      else if (goingUp || y < 200) header.classList.remove("is-hidden");
    }
    lastY = y;

    toTop?.classList.toggle("is-visible", y > vh * 1.2);

    if (!reducedMotion && y < vh * 1.5) {
      parallaxEls.forEach((el) => { el.style.transform = `translate3d(0, ${y * Number(el.dataset.parallax)}px, 0)`; });
    }

    // promise words light up one by one
    if (promiseWords.length) {
      const r = promise.getBoundingClientRect();
      const p = reducedMotion ? 1 : clamp((vh * 0.85 - r.top) / (r.height + vh * 0.3));
      const lit = Math.round(p * promiseWords.length);
      promiseWords.forEach((w, i) => w.classList.toggle("is-lit", i < lit));
    }

    // journey line grows as you read
    if (timeline) {
      const r = timeline.getBoundingClientRect();
      const mark = vh * 0.62;
      timelineFill.style.transform = `scaleY(${clamp((mark - r.top) / r.height)})`;
      tlItems.forEach((item) => {
        const dot = item.firstElementChild.getBoundingClientRect();
        item.classList.toggle("is-lit", dot.top + dot.height / 2 < mark);
      });
    }
  }

  if (lenis) lenis.on("scroll", (e) => onScroll(e.scroll));
  else window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });
  window.addEventListener("resize", () => onScroll(window.scrollY));
  onScroll(window.scrollY);

  toTop?.addEventListener("click", () => scrollToTarget(0));

  /* ---------- Cursor glow, tilt & magnetic buttons ---------- */
  if (finePointer && !reducedMotion) {
    const glow = $("#cursorGlow");
    let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
    window.addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; glow.classList.add("is-on"); }, { passive: true });
    document.addEventListener("mouseleave", () => glow.classList.remove("is-on"));
    const follow = () => {
      gx += (tx - gx) * 0.08; gy += (ty - gy) * 0.08;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      requestAnimationFrame(follow);
    };
    follow();

    const tilt = (el, strength) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
        el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * strength}deg) rotateY(${(px - 0.5) * strength}deg) translateY(-4px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    };
    $$(".service").forEach((el) => tilt(el, 7));
    $$(".tilt").forEach((el) => tilt(el, 6));

    $$(".magnetic").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
      });
      btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
    });
  }

  /* ---------- Little heartbeat ---------- */
  const AGES = [
    { label: "A newborn’s heart", range: "100–160", bpm: 135 },
    { label: "A baby’s heart (1–12 months)", range: "100–150", bpm: 125 },
    { label: "A toddler’s heart (1–3 years)", range: "90–140", bpm: 115 },
    { label: "A pre-schooler’s heart (3–5 years)", range: "80–120", bpm: 100 },
    { label: "A school child’s heart (6–12 years)", range: "70–110", bpm: 88 },
    { label: "A teenager’s heart", range: "60–100", bpm: 75 },
  ];
  const ageRange = $("#ageRange");
  const ageBtns = $$("#ageLabels button");
  const bpmNum = $("#bpmNum");
  const bpmNote = $("#bpmNote");
  const beatsToday = $("#beatsToday");
  const bigHeart = $("#bigHeart");
  const soundToggle = $("#soundToggle");
  let bpm = AGES[0].bpm;
  let shownBpm = bpm;

  function tweenNumber(from, to, onUpdate, dur = 700) {
    const t0 = performance.now();
    const step = (now) => {
      const p = clamp((now - t0) / dur);
      onUpdate(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setAge(i) {
    const age = AGES[i];
    const prev = shownBpm;
    bpm = age.bpm;
    shownBpm = bpm;
    ageRange.value = i;
    ageRange.style.setProperty("--p", `${(i / (AGES.length - 1)) * 100}%`);
    ageBtns.forEach((b, n) => b.classList.toggle("is-active", n === i));
    bpmNote.innerHTML = `${age.label} usually beats around <strong>${age.range}</strong> times a minute.`;
    bigHeart.style.setProperty("--beat", `${(60 / bpm).toFixed(3)}s`);
    tweenNumber(prev, bpm, (v) => {
      bpmNum.textContent = Math.round(v);
      beatsToday.textContent = Math.round(v * 60 * 24).toLocaleString("en-IN");
    });
  }
  if (ageRange) {
    ageRange.addEventListener("input", () => setAge(Number(ageRange.value)));
    ageBtns.forEach((b) => b.addEventListener("click", () => setAge(Number(b.dataset.i))));
    setAge(0);
  }

  // A soft, synthesised "lub-dub" — no audio files needed
  let audioCtx = null;
  let soundOn = false;
  let beatTimer = null;

  function thump(when, freq, gainPeak, length) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, when);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, when + length);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainPeak, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(filter).connect(gain).connect(audioCtx.destination);
    osc.start(when);
    osc.stop(when + length + 0.05);
  }

  function scheduleBeat() {
    if (!soundOn) return;
    const period = 60 / bpm;
    const t = audioCtx.currentTime + 0.02;
    thump(t + period * 0.1, 70, 0.55, 0.16);  // lub
    thump(t + period * 0.38, 95, 0.35, 0.11); // dub
    beatTimer = setTimeout(scheduleBeat, period * 1000);
  }

  function setSound(on) {
    soundOn = on;
    soundToggle.setAttribute("aria-pressed", String(on));
    $(".material-symbols-outlined", soundToggle).textContent = on ? "volume_up" : "volume_off";
    $(".sound-toggle__label", soundToggle).textContent = on ? "Listening… tap to pause" : "Tap to hear the heartbeat";
    clearTimeout(beatTimer);
    if (on) {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume();
      // restart the visual beat so sound and pulse share a rhythm
      const svg = $("svg", bigHeart);
      svg.style.animation = "none";
      void svg.offsetWidth;
      svg.style.animation = "";
      scheduleBeat();
    }
  }

  function burstHearts(x, y) {
    if (reducedMotion) return;
    for (let n = 0; n < 7; n++) {
      const s = document.createElement("span");
      s.className = "material-symbols-outlined fill";
      s.textContent = "favorite";
      const angle = (Math.PI * 2 * n) / 7 + Math.random() * 0.5;
      const dist = 60 + Math.random() * 70;
      Object.assign(s.style, {
        position: "fixed", left: `${x}px`, top: `${y}px`, zIndex: 150, pointerEvents: "none",
        fontSize: `${12 + Math.random() * 14}px`, color: n % 2 ? "#ea8b99" : "#f4b2bb",
        transform: "translate(-50%, -50%)",
      });
      document.body.appendChild(s);
      s.animate([
        { transform: "translate(-50%, -50%) scale(0.4)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist - 40}px)) scale(1)`, opacity: 0 },
      ], { duration: 1100 + Math.random() * 500, easing: "cubic-bezier(.22,1,.36,1)" }).onfinish = () => s.remove();
    }
  }

  soundToggle?.addEventListener("click", () => setSound(!soundOn));
  bigHeart?.addEventListener("click", (e) => {
    const r = bigHeart.getBoundingClientRect();
    burstHearts(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    navigator.vibrate?.([30, 120, 20]);
    setSound(!soundOn);
  });
  // politely stop the sound once the section scrolls away
  const hbSection = $("#heartbeat");
  if (hbSection) {
    new IntersectionObserver(([entry]) => { if (!entry.isIntersecting && soundOn) setSound(false); }).observe(hbSection);
  }

  /* ---------- Breathe with us ---------- */
  const breath = $("#breath");
  const breathCircle = $(".breath__circle", breath || document);
  const breathLabel = $("#breathLabel");
  const breathCount = $("#breathCount");
  const breatheBtn = $("#breatheBtn");
  const breatheBtnText = $("#breatheBtnText");
  const PHASES = [
    { text: "Breathe in slowly…", scale: 1, secs: 4 },
    { text: "Hold, gently…", scale: 1, secs: 2 },
    { text: "And breathe out…", scale: 0.72, secs: 6 },
  ];
  const ROUNDS = 5; // 5 × 12s = one calm minute
  let breathTimer = null;
  let breathing = false;

  function setLabel(text) {
    breathLabel.style.opacity = 0;
    setTimeout(() => { breathLabel.textContent = text; breathLabel.style.opacity = 1; }, 300);
  }

  function stopBreathing(finished) {
    breathing = false;
    clearTimeout(breathTimer);
    breath.classList.remove("is-running");
    breathCircle.style.transitionDuration = "2s";
    breathCircle.style.transform = "";
    breathCount.textContent = "";
    breatheBtnText.textContent = finished ? "Breathe again" : "Begin one minute of calm";
    $(".material-symbols-outlined", breatheBtn).textContent = "air";
    setLabel(finished ? "Well done. You’re doing beautifully." : "Ready when you are");
  }

  function runPhase(round, phase) {
    if (!breathing) return;
    if (phase >= PHASES.length) { round++; phase = 0; }
    if (round >= ROUNDS) { stopBreathing(true); return; }
    const p = PHASES[phase];
    breathCount.textContent = `Breath ${round + 1} of ${ROUNDS}`;
    setLabel(p.text);
    breathCircle.style.transitionDuration = `${p.secs}s`;
    breathCircle.style.transform = `scale(${p.scale})`;
    breathTimer = setTimeout(() => runPhase(round, phase + 1), p.secs * 1000);
  }

  breatheBtn?.addEventListener("click", () => {
    if (breathing) { stopBreathing(false); return; }
    breathing = true;
    breath.classList.add("is-running");
    breatheBtnText.textContent = "Pause";
    $(".material-symbols-outlined", breatheBtn).textContent = "pause";
    breathCircle.style.transitionDuration = "0.8s";
    breathCircle.style.transform = "scale(0.72)";
    setLabel("Let your shoulders soften…");
    breathTimer = setTimeout(() => runPhase(0, 0), 1800);
  });

  /* ---------- Packing checklist ---------- */
  const checks = $$("#checklist input");
  const packFill = $("#packFill");
  const packMsg = $("#packMsg");
  const packDefault = packMsg?.textContent;
  const saved = store.get("khc-pack") || {};

  function updatePack() {
    const done = checks.filter((c) => c.checked).length;
    packFill.style.width = `${(done / checks.length) * 100}%`;
    const all = done === checks.length;
    packMsg.classList.toggle("is-ready", all);
    packMsg.textContent = all ? "All packed. You’re ready — and you’re doing a wonderful job." : packDefault;
    store.set("khc-pack", Object.fromEntries(checks.map((c) => [c.dataset.key, c.checked])));
  }
  checks.forEach((c) => {
    c.checked = Boolean(saved[c.dataset.key]);
    c.addEventListener("change", updatePack);
  });
  if (checks.length) updatePack();

  /* ---------- FAQ accordion ---------- */
  const faqItems = $$(".faq__item");
  faqItems.forEach((item) => {
    const q = $(".faq__q", item);
    q.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");
      faqItems.forEach((other) => {
        other.classList.remove("is-open");
        $(".faq__q", other).setAttribute("aria-expanded", "false");
      });
      item.classList.toggle("is-open", willOpen);
      q.setAttribute("aria-expanded", String(willOpen));
      setTimeout(() => lenis?.resize(), 600);
    });
  });
  if (faqItems[0]) {
    faqItems[0].classList.add("is-open");
    $(".faq__q", faqItems[0]).setAttribute("aria-expanded", "true");
  }

  /* ---------- Appointment form ---------- */
  const form = $("#apptForm");
  const formDone = $("#formDone");
  const typeSelect = $("#fType");
  const CLINIC_WHATSAPP = "919845012345";

  function setConsultType(value) {
    if (!typeSelect) return;
    const opt = Array.from(typeSelect.options).find((o) => o.text === value);
    if (opt) typeSelect.value = opt.value;
  }

  function validateField(input) {
    const field = input.closest(".field");
    const ok = input.checkValidity() && input.value.trim() !== "";
    field.classList.toggle("is-invalid", !ok);
    return ok;
  }

  if (form) {
    const required = $$("[required]", form);
    required.forEach((input) => {
      input.addEventListener("blur", () => { if (input.value) validateField(input); });
      input.addEventListener("input", () => { if (input.closest(".field").classList.contains("is-invalid")) validateField(input); });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const results = required.map(validateField);
      const firstBad = required[results.indexOf(false)];
      if (firstBad) { firstBad.focus(); return; }

      const data = Object.fromEntries(new FormData(form));
      const msg = [
        "Hello Kids Heart Clinic, I’d like to request an appointment.",
        "",
        `Parent/guardian: ${data.name.trim()}`,
        `Child: ${data.child.trim()}`,
        `Phone: ${data.phone.trim()}`,
        `Visit type: ${data.type}`,
        data.notes.trim() ? `Notes: ${data.notes.trim()}` : "",
      ].filter((line, i, arr) => line !== "" || i === 1).join("\n");

      $("#waLink").href = `https://wa.me/${CLINIC_WHATSAPP}?text=${encodeURIComponent(msg)}`;
      $("#doneName").textContent = data.name.trim().split(/\s+/)[0];
      form.hidden = true;
      formDone.hidden = false;
      lenis?.resize();
      const wrap = $(".form-wrap");
      const r = wrap.getBoundingClientRect();
      burstHearts(r.left + r.width / 2, r.top + 120);
      if (r.top < 0) scrollToTarget(wrap);
    });

    $("#formReset")?.addEventListener("click", () => {
      formDone.hidden = true;
      form.hidden = false;
      lenis?.resize();
      $("#fName").focus();
    });
  }

  /* ---------- Footer year ---------- */
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
