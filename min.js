"use strict";

(() => {
  const STORAGE_KEY = "mstudio2";
  const DEF_FONT = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";


  const TPL = {
    "Flowchart": `flowchart TD
  Start([Start]) --> Check{Valid?}
  Check -->|Yes| Process[Process]
  Check -->|No| Fix[Fix Inputs]
  Fix --> Check
  Process --> Output[/Output/]
  Output --> Done([Done])`,

    "Sequence": `sequenceDiagram
  autonumber
  actor User
  participant App
  participant DB
  User->>App: Request
  App->>DB: Query
  DB-->>App: Data
  App-->>User: Response`,

    "Class": `classDiagram
  class Animal {
    +String name
    +int age
    +speak() void
  }
  class Dog {
    +String breed
    +fetch() void
  }
  class Cat {
    +Boolean indoor
    +purr() void
  }
  Animal <|-- Dog
  Animal <|-- Cat`,

    "State": `stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start()
  Running --> Paused : pause()
  Paused --> Running : resume()
  Running --> [*] : stop()`,

    "ER": `erDiagram
  USER ||--o{ ORDER : places
  ORDER ||--|{ ITEM : contains
  USER {
    int id PK
    string name
    string email
  }
  ORDER {
    int id PK
    date created_at
  }`,

    "Gantt": `gantt
  title Project Roadmap
  dateFormat YYYY-MM-DD
  section Phase 1
  Design   :done, des, 2026-01-01, 7d
  Develop  :active, dev, after des, 10d
  section Phase 2
  Testing  :test, after dev, 5d
  Release  :crit, rel, after test, 2d`,

    "Mindmap": `mindmap
  root((Project))
    Planning
      Goals
      Resources
    Execution
      Development
      Testing
    Delivery
      Deployment
      Monitoring`,

    "Pie": `pie showData
  title Resource Allocation
  "Development" : 45
  "Testing" : 25
  "Design" : 20
  "Docs" : 10`,

    "Journey": `journey
  title User Onboarding
  section Discovery
    Visit site: 4: User
    Read docs: 3: User
  section Setup
    Create account: 5: User
    Configure: 4: User
  section Usage
    First diagram: 5: User
    Share: 5: User`,

    "Git Graph": `gitGraph
  commit id: "Initial"
  branch feature
  checkout feature
  commit id: "Feature work"
  commit id: "More work"
  checkout main
  merge feature id: "Merge feature"
  commit id: "Release" tag: "v1.0"`,

    "C4 Architecture": `C4Context
  title System Context
  Person(user, "User", "Creates diagrams.")
  System(app, "SGS Studio", "Browser diagramming app.")
  System_Ext(ai, "AI API", "Diagram generation.")
  Rel(user, app, "Uses")
  Rel(app, ai, "Requests completions")`,

    "Requirement Diagram": `requirementDiagram
  requirement req_render {
    id: REQ-01
    text: Real-time debounced render within 250ms.
    risk: low
    verifymethod: test
  }
  element renderer {
    type: module
  }
  renderer - satisfies -> req_render`
  };

  
  const $ = (id) => document.getElementById(id);

  function slugify(text) {
    return (text || "diagram").toLowerCase().trim()
      .replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-") || "diagram";
  }

  
  function toast(msg, type = "info", ms = 3200) {
    let wrap = $("toast") || document.querySelector(".toast-container");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toast";
      wrap.className = "toast-container";
      Object.assign(wrap.style, {
        position: "fixed", bottom: "24px", right: "24px", zIndex: "1000",
        display: "flex", flexDirection: "column", gap: "8px", pointerEvents: "none"
      });
      document.body.appendChild(wrap);
    }

    const item = document.createElement("div");
    item.className = "toast-item" + (type === "success" ? " success" : type === "error" ? " error" : "");
    item.setAttribute("role", "alert");
    item.textContent = msg;
    Object.assign(item.style, { pointerEvents: "auto" });
    wrap.appendChild(item);

    const st = $("st");
    if (st) st.textContent = msg;

    setTimeout(() => {
      item.style.transition = "opacity 200ms, transform 200ms";
      item.style.opacity = "0";
      item.style.transform = "translateY(8px) scale(0.96)";
      setTimeout(() => {
        item.remove();
        if (st && st.textContent === msg) st.textContent = "";
      }, 220);
    }, ms);
  }

  
  
  
  const DEFAULT_STATE = {
    docs: [{ name: "Flowchart", code: TPL["Flowchart"], hist: [] }],
    cur: 0,
    theme: "default",
    look: "classic",
    c1: "#6366f1",
    c2: "#ffffff",
    c3: "#334155",
    c4: "#ffffff",
    font: DEF_FONT,
    key: "",
    base: "https://api.deepseek.com",
    model: "deepseek-chat"
  };

  let S = structuredClone(DEFAULT_STATE);

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        Object.assign(S, saved);
        if (!Array.isArray(S.docs) || !S.docs.length) {
          S.docs = structuredClone(DEFAULT_STATE.docs);
        } else {
          S.docs = S.docs.map((d, i) => ({
            name: d.name || ("Diagram " + (i + 1)),
            code: typeof d.code === "string" ? d.code : TPL["Flowchart"],
            hist: Array.isArray(d.hist) ? d.hist : []
          }));
        }
        if (typeof S.cur !== "number" || S.cur < 0 || S.cur >= S.docs.length) S.cur = 0;
      }
    } catch (e) {
      console.warn("[MStudio] loadSavedState:", e);
    }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) {  }
  }

  function doc() {
    if (!S.docs.length) { S.docs = structuredClone(DEFAULT_STATE.docs); S.cur = 0; }
    return S.docs[S.cur] || S.docs[0];
  }

  function bgColor() {
    const map = { dark: "#0b0f19", forest: "#f4faf6", neutral: "#f8fafc" };
    return S.theme === "base" ? (S.c4 || "#ffffff") : (map[S.theme] || "#ffffff");
  }

  
  
  
  let renderSeq = 0;
  let needFit = true;
  let debTimer = null;

  function initMermaid() {
    if (typeof mermaid === "undefined") return;
    const custom = S.theme === "base";
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: S.theme || "default",
      look: S.look || "classic",
      fontFamily: S.font || DEF_FONT,
      flowchart: { htmlLabels: true },
      sequence: { useMaxWidth: false },
      themeVariables: custom ? {
        primaryColor: S.c1,
        primaryTextColor: S.c2,
        lineColor: S.c3,
        background: S.c4,
        mainBkg: S.c1,
        nodeBorder: S.c3,
        textColor: S.c3,
        edgeLabelBackground: S.c4
      } : {}
    });
  }

  async function render() {
    if (typeof mermaid === "undefined") { setTimeout(render, 180); return; }

    const code = $("code") ? $("code").value : "";
    doc().code = code;
    persist();
    initMermaid();

    const out = $("out"), err = $("err"), view = $("view");
    if (!code.trim()) { if (out) out.innerHTML = ""; if (err) err.textContent = ""; return; }

    try {
      await mermaid.parse(code);
      if (err) err.textContent = "";
      const id = "ms-svg-" + (++renderSeq);
      const { svg } = await mermaid.render(id, code);

      if (out) {
        
        const prevPositions = nodePositions;
        out.innerHTML = svg;

        const svgEl = out.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "none";
          const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
          if (vb && vb.width > 0) {
            svgEl.setAttribute("width", vb.width);
            svgEl.setAttribute("height", vb.height);
          }
        }

        
        if (Object.keys(prevPositions).length) {
          applyNodePositions();
        }

        
        if (dragModeActive) {
          bindNodeDragEvents();
        }
      }

      if (view) view.style.backgroundColor = bgColor();
      if (needFit) { needFit = false; fitViewport(); }
    } catch (e) {
      const msg = String(e.message || e).split("\n").slice(0, 5).join("\n");
      if (err) err.textContent = msg;
    }
  }

  function scheduleRender(delay = 250) {
    clearTimeout(debTimer);
    debTimer = setTimeout(render, delay);
  }

  
  
  
  const VP = { x: 0, y: 0, k: 1 };
  let dragging = null;

  function applyVP() {
    const out = $("out");
    if (out) out.style.transform = `translate(${VP.x}px,${VP.y}px) scale(${VP.k})`;
    const zr = $("zr");
    if (zr) zr.textContent = Math.round(VP.k * 100) + "%";
  }

  function zoom(factor, px, py) {
    const view = $("view");
    if (!view) return;
    px = px !== undefined ? px : view.clientWidth / 2;
    py = py !== undefined ? py : view.clientHeight / 2;
    const k = Math.min(15, Math.max(0.05, VP.k * factor));
    const f = k / VP.k;
    VP.x = px - (px - VP.x) * f;
    VP.y = py - (py - VP.y) * f;
    VP.k = k;
    applyVP();
  }

  function fitViewport() {
    const view = $("view"), out = $("out");
    if (!view || !out) return;
    const svgEl = out.querySelector("svg");
    if (!svgEl) return;
    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    const w = (vb && vb.width > 0) ? vb.width : (parseFloat(svgEl.getAttribute("width")) || 800);
    const h = (vb && vb.height > 0) ? vb.height : (parseFloat(svgEl.getAttribute("height")) || 600);
    if (!w || !h) return;
    const pad = 56;
    const k = Math.min((view.clientWidth - pad) / w, (view.clientHeight - pad) / h, 2);
    VP.k = Math.max(0.05, k);
    VP.x = (view.clientWidth - w * VP.k) / 2;
    VP.y = (view.clientHeight - h * VP.k) / 2;
    applyVP();
  }

  function resetZoom100() {
    const view = $("view"), out = $("out");
    VP.k = 1;
    if (view && out) {
      const svgEl = out.querySelector("svg");
      const vb = svgEl && svgEl.viewBox && svgEl.viewBox.baseVal;
      const w = vb && vb.width > 0 ? vb.width : 800;
      const h = vb && vb.height > 0 ? vb.height : 600;
      VP.x = (view.clientWidth - w) / 2;
      VP.y = (view.clientHeight - h) / 2;
    } else { VP.x = 0; VP.y = 0; }
    applyVP();
  }

  function initViewport() {
    const view = $("view");
    if (!view) return;

    
    view.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = view.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    
    view.addEventListener("pointerdown", (e) => {
      if (dragModeActive) return; 
      if (e.button !== 0) return;
      dragging = { sx: e.clientX - VP.x, sy: e.clientY - VP.y };
      view.setPointerCapture(e.pointerId);
      view.classList.add("g");
    });
    view.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      VP.x = e.clientX - dragging.sx;
      VP.y = e.clientY - dragging.sy;
      applyVP();
    });
    const stopPan = () => { dragging = null; view.classList.remove("g"); };
    view.addEventListener("pointerup", stopPan);
    view.addEventListener("pointercancel", stopPan);
    view.addEventListener("lostpointercapture", stopPan);

    
    if ($("zi")) $("zi").onclick = () => zoom(1.25);
    if ($("zo")) $("zo").onclick = () => zoom(1 / 1.25);
    if ($("fit")) $("fit").onclick = fitViewport;
    if ($("zr")) $("zr").onclick = resetZoom100;

    
    const rz = $("rz");
    if (rz) {
      rz.addEventListener("pointerdown", (e) => {
        rz.setPointerCapture(e.pointerId);
        document.body.style.userSelect = "none";
        const mv = (ev) => {
          const pct = Math.min(80, Math.max(15, (ev.clientX / window.innerWidth) * 100));
          document.documentElement.style.setProperty("--lw", pct + "%");
        };
        const up = () => {
          document.body.style.userSelect = "";
          rz.removeEventListener("pointermove", mv);
          rz.removeEventListener("pointerup", up);
          fitViewport();
        };
        rz.addEventListener("pointermove", mv);
        rz.addEventListener("pointerup", up);
      });
    }
  }

  
  
  
  

  let dragModeActive = false;
  let nodePositions = {};   
  const DRAG_SENSITIVITY = 0.5;

  
  const NODE_SELECTORS = [
    ".node", ".classGroup", ".statediagram-state",
    ".entityBox", ".actor", '[class*="node"]'
  ];

  function getDraggableNodes() {
    const out = $("out");
    if (!out) return [];
    const svgEl = out.querySelector("svg");
    if (!svgEl) return [];

    const seen = new Set();
    const nodes = [];
    for (const sel of NODE_SELECTORS) {
      svgEl.querySelectorAll(sel).forEach((el) => {
        if (!seen.has(el)) {
          seen.add(el);
          nodes.push(el);
        }
      });
    }
    return nodes;
  }

  function nodeKey(el, index) {
    
    const text = (el.textContent || "").trim().slice(0, 32).replace(/\s+/g, "_");
    return `n${index}_${text}`;
  }

  function getBaseTransform(el) {
    if (el._msBaseTransform === undefined) {
      el._msBaseTransform = el.getAttribute("transform") || "";
    }
    return el._msBaseTransform;
  }

  function applyNodePositions() {
    const nodes = getDraggableNodes();
    nodes.forEach((el, i) => {
      const key = nodeKey(el, i);
      const pos = nodePositions[key];
      if (pos && (pos.dx !== 0 || pos.dy !== 0)) {
        const base = getBaseTransform(el);
        
        el.setAttribute("transform", `${base} translate(${pos.dx},${pos.dy})`);
      }
    });
  }

  function bindNodeDragEvents() {
    const svgEl = $("out") ? $("out").querySelector("svg") : null;
    if (!svgEl) return;

    const nodes = getDraggableNodes();

    nodes.forEach((el, i) => {
      const key = nodeKey(el, i);
      if (!nodePositions[key]) nodePositions[key] = { dx: 0, dy: 0 };

      el.style.cursor = "grab";
      el.setAttribute("data-ms-key", key);

      
      if (el._msDragBound) return;
      el._msDragBound = true;

      let drag = null;

      el.addEventListener("pointerdown", (e) => {
        if (!dragModeActive) return;
        e.stopPropagation(); 
        e.preventDefault();
        drag = {
          startX: e.clientX,
          startY: e.clientY,
          origDx: nodePositions[key].dx,
          origDy: nodePositions[key].dy
        };
        el.setPointerCapture(e.pointerId);
        el.style.cursor = "grabbing";
        el.classList.add("node-dragging");
      });

      el.addEventListener("pointermove", (e) => {
        if (!drag) return;
        
        const dxScreen = e.clientX - drag.startX;
        const dyScreen = e.clientY - drag.startY;
        const svgScale = VP.k; 
        nodePositions[key].dx = drag.origDx + (dxScreen * DRAG_SENSITIVITY) / svgScale;
        nodePositions[key].dy = drag.origDy + (dyScreen * DRAG_SENSITIVITY) / svgScale;

        const base = getBaseTransform(el);
        el.setAttribute("transform",
          `${base} translate(${nodePositions[key].dx},${nodePositions[key].dy})`);
      });

      const stopDrag = () => {
        if (!drag) return;
        drag = null;
        el.style.cursor = "grab";
        el.classList.remove("node-dragging");
      };
      el.addEventListener("pointerup", stopDrag);
      el.addEventListener("pointercancel", stopDrag);
    });
  }

  function toggleDragMode() {
    dragModeActive = !dragModeActive;
    const btn = $("drag-mode");
    const rstBtn = $("reset-layout");
    const view = $("view");
    const out = $("out");

    if (btn) {
      btn.style.background = dragModeActive ? "var(--accent, #6366f1)" : "";
      btn.style.color = dragModeActive ? "#fff" : "";
      btn.textContent = dragModeActive ? "✓ Move boxes" : "Move boxes";
    }
    if (rstBtn) rstBtn.style.display = dragModeActive ? "" : "none";

    if (out) {
      if (dragModeActive) {
        out.classList.add("drag-active");
        bindNodeDragEvents();
      } else {
        out.classList.remove("drag-active");
      }
    }

    
    if (view) {
      view.style.cursor = dragModeActive ? "default" : "grab";
    }

    toast(dragModeActive ? "Drag mode on — drag any box to reposition it" : "Drag mode off", "info", 2000);
  }

  function resetLayout() {
    nodePositions = {};
    
    const nodes = getDraggableNodes();
    nodes.forEach((el, i) => {
      nodePositions[nodeKey(el, i)] = { dx: 0, dy: 0 };
      const base = getBaseTransform(el);
      if (base) {
        el.setAttribute("transform", base);
      } else {
        el.removeAttribute("transform");
      }
    });
    if (dragModeActive) {
      toggleDragMode(); 
    }
    toast("Layout reset to auto-arrangement", "success");
  }

  
  
  
  function renderTabs() {
    const tabs = $("tabs");
    if (!tabs) return;
    tabs.innerHTML = "";
    S.docs.forEach((d, i) => {
      const btn = document.createElement("button");
      btn.className = "tab" + (i === S.cur ? " on" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", i === S.cur ? "true" : "false");
      btn.textContent = d.name;
      btn.onclick = () => { S.cur = i; loadDoc(); };
      btn.ondblclick = (e) => {
        e.stopPropagation();
        const n = prompt("Rename diagram:", d.name);
        if (n && n.trim()) { d.name = n.trim(); persist(); renderTabs(); }
      };
      if (S.docs.length > 1) {
        const x = document.createElement("span");
        x.textContent = "×"; x.title = "Close";
        x.onclick = (e) => {
          e.stopPropagation();
          if (!confirm(`Delete "${d.name}"?`)) return;
          S.docs.splice(i, 1);
          S.cur = i < S.cur ? S.cur - 1 : Math.min(S.cur, S.docs.length - 1);
          persist(); loadDoc();
        };
        btn.appendChild(x);
      }
      tabs.appendChild(btn);
    });
  }

  function renderHistory() {
    const ver = $("ver");
    if (!ver) return;
    ver.innerHTML = "";
    const hist = doc().hist || [];
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = hist.length ? `History (${hist.length})` : "Versions";
    ver.appendChild(opt0);
    hist.forEach((h, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${h.t} · ${h.why}`;
      ver.appendChild(opt);
    });
  }

  function newDoc(name, code) {
    S.docs.push({ name: name || "Untitled", code: code || "flowchart TD\n  A --> B", hist: [] });
    S.cur = S.docs.length - 1;
    nodePositions = {}; 
    persist();
    loadDoc();
  }

  function loadDoc() {
    const d = doc();
    if ($("code")) $("code").value = d.code;
    renderTabs();
    renderHistory();
    nodePositions = {};
    needFit = true;
    render();
  }

  
  
  
  function dl(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1200);
  }

  function svgText() {
    const out = $("out");
    if (!out) return null;
    const svg = out.querySelector("svg");
    if (!svg) return null;
    const clone = svg.cloneNode(true);
    clone.removeAttribute("style");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const x = vb ? vb.x : 0, y = vb ? vb.y : 0;
    const w = vb && vb.width > 0 ? vb.width : (parseFloat(svg.getAttribute("width")) || 800);
    const h = vb && vb.height > 0 ? vb.height : (parseFloat(svg.getAttribute("height")) || 600);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x); rect.setAttribute("y", y);
    rect.setAttribute("width", w); rect.setAttribute("height", h);
    rect.setAttribute("fill", bgColor());
    clone.insertBefore(rect, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  }

  function exportSVG() {
    const xml = svgText();
    if (!xml) { toast("No diagram to export", "error"); return; }
    dl(new Blob([xml], { type: "image/svg+xml" }), slugify(doc().name) + ".svg");
    toast("SVG exported", "success");
  }

  function exportPNG() {
    const xml = svgText();
    if (!xml) { toast("No diagram to export", "error"); return; }
    const svg = $("out").querySelector("svg");
    const vb = svg && svg.viewBox && svg.viewBox.baseVal;
    const w = vb && vb.width > 0 ? vb.width : (parseFloat(svg.getAttribute("width")) || 800);
    const h = vb && vb.height > 0 ? vb.height : (parseFloat(svg.getAttribute("height")) || 600);
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        ctx.fillStyle = bgColor();
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
          URL.revokeObjectURL(url);
          if (b) { dl(b, slugify(doc().name) + ".png"); toast("PNG exported (2x)", "success"); }
          else { exportSVG(); toast("PNG failed, fell back to SVG", "error"); }
        }, "image/png");
      } catch (e) { URL.revokeObjectURL(url); exportSVG(); toast("PNG error — SVG fallback", "error"); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); exportSVG(); toast("PNG failed, fell back to SVG", "error"); };
    img.src = url;
  }

  function saveMmd() {
    const code = $("code") ? $("code").value : "";
    dl(new Blob([code], { type: "text/plain" }), slugify(doc().name) + ".mmd");
    toast("Saved .mmd file", "success");
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText($("code") ? $("code").value : "");
      toast("Code copied to clipboard", "success");
    } catch { toast("Copy failed", "error"); }
  }

  async function shareLink() {
    const code = $("code") ? $("code").value : "";
    try {
      const enc = btoa(unescape(encodeURIComponent(code)));
      const url = location.origin + location.pathname + "#d=" + enc;
      await navigator.clipboard.writeText(url);
      toast("Share link copied", "success");
    } catch { toast("Could not copy share link", "error"); }
  }

  function checkHash() {
    if (!location.hash.startsWith("#d=")) return;
    try {
      const decoded = decodeURIComponent(escape(atob(location.hash.slice(3))));
      if (decoded && decoded.trim()) newDoc("Shared", decoded);
    } catch (e) { console.warn("[MStudio] checkHash:", e); }
  }

  
  
  
  function cleanCode(raw) {
    if (!raw) return "";
    return raw.trim()
      .replace(/^```(?:mermaid)?\s*\r?\n?/i, "")
      .replace(/\r?\n?```\s*$/i, "").trim();
  }

  function snapshot(why) {
    const d = doc();
    const code = $("code") ? $("code").value : "";
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (!d.hist) d.hist = [];
    d.hist.unshift({ t, code, why: (why || "Edit").slice(0, 30) });
    if (d.hist.length > 25) d.hist.length = 25;
    renderHistory();
    persist();
  }

  async function aiStream(msgs, onDelta) {
    const base = (S.base || DEFAULT_STATE.base).replace(/\/+$/, "");
    const resp = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + S.key },
      body: JSON.stringify({ model: S.model || DEFAULT_STATE.model, messages: msgs, temperature: 0.2, stream: true })
    });
    if (!resp.ok) throw new Error("API " + resp.status + ": " + (await resp.text()).slice(0, 200));

    const reader = resp.body.getReader(), dec = new TextDecoder();
    let buf = "", full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n"); buf = lines.pop();
      for (const ln of lines) {
        const t = ln.trim();
        if (!t.startsWith("data:")) continue;
        const d = t.slice(5).trim();
        if (d === "[DONE]") continue;
        try {
          const delta = JSON.parse(d).choices[0].delta.content || "";
          if (delta) { full += delta; onDelta(full); }
        } catch (e) {  }
      }
    }
    return full;
  }

  async function generate(prompt) {
    const p = (prompt || "").trim();
    if (!p) return;
    if (!S.key) { toast("Enter your AI API key in settings first", "error"); openCfg(); return; }

    const codeEl = $("code"), genBtn = $("gen"), stEl = $("st");
    const before = codeEl ? codeEl.value : "";
    if (genBtn) genBtn.disabled = true;
    if (stEl) stEl.textContent = "Generating…";

    const msgs = [
      { role: "system", content: "You write Mermaid diagram code. Reply with ONLY valid Mermaid syntax, no markdown fences, no explanation. Quote labels containing special characters. If existing code is given, modify it to fulfil the request and keep unmentioned parts." },
      { role: "user", content: `Current code:\n${before}\n\nRequest: ${p}` }
    ];

    try {
      let code = "";
      for (let i = 0; i < 3; i++) {
        if (i > 0 && stEl) stEl.textContent = `Auto-repair attempt ${i + 1}/3…`;
        const raw = await aiStream(msgs, (partial) => { if (codeEl) codeEl.value = cleanCode(partial); });
        code = cleanCode(raw);
        try { await mermaid.parse(code); break; }
        catch (parseErr) {
          if (i < 2) {
            msgs.push({ role: "assistant", content: raw });
            msgs.push({ role: "user", content: `Syntax error: ${parseErr.message || parseErr}\nFix it and reply with ONLY valid Mermaid code.` });
          } else { throw new Error("Syntax error after 3 attempts: " + (parseErr.message || parseErr)); }
        }
      }
      if (code !== before) snapshot(p);
      if (codeEl) codeEl.value = code;
      if ($("prompt")) $("prompt").value = "";
      if (stEl) stEl.textContent = "";
      nodePositions = {}; 
      needFit = true;
      render();
      toast("Diagram generated", "success");
    } catch (e) {
      if (codeEl) codeEl.value = before;
      if (stEl) stEl.textContent = "";
      if ($("err")) $("err").textContent = String(e.message || e);
      toast("AI error: " + (e.message || e), "error");
    } finally {
      if (genBtn) genBtn.disabled = false;
    }
  }

  
  
  
  function openCfg() {
    if (!$("dlg")) return;
    if ($("key")) $("key").value = S.key;
    if ($("base")) $("base").value = S.base;
    if ($("model")) $("model").value = S.model;
    $("dlg").showModal();
  }

  
  
  
  function bindControls() {
    
    const tplSel = $("tpl");
    if (tplSel) {
      tplSel.innerHTML = '<option value="">New from template…</option>';
      for (const k of Object.keys(TPL)) {
        const o = document.createElement("option");
        o.value = k; o.textContent = k;
        tplSel.appendChild(o);
      }
      tplSel.onchange = (e) => { const k = e.target.value; if (k) newDoc(k, TPL[k]); e.target.value = ""; };
    }

    
    if ($("add")) $("add").onclick = () => newDoc("Untitled", "flowchart TD\n  A[Start] --> B[End]");

    
    if ($("ver")) {
      $("ver").onchange = (e) => {
        const idx = e.target.value;
        if (idx !== "" && doc().hist[idx]) {
          snapshot("Before rollback");
          doc().code = doc().hist[idx].code;
          if ($("code")) $("code").value = doc().hist[idx].code;
          nodePositions = {};
          needFit = true; render();
          toast("Rolled back", "info");
        }
        e.target.value = "";
      };
    }

    
    const codeEl = $("code");
    if (codeEl) {
      codeEl.addEventListener("input", () => scheduleRender(250));
      codeEl.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          if (e.shiftKey) {
            const s = codeEl.selectionStart;
            const lineStart = codeEl.value.lastIndexOf("\n", s - 1) + 1;
            if (codeEl.value.slice(lineStart, lineStart + 2) === "  ") {
              codeEl.value = codeEl.value.slice(0, lineStart) + codeEl.value.slice(lineStart + 2);
              codeEl.selectionStart = codeEl.selectionEnd = Math.max(lineStart, s - 2);
            }
          } else {
            codeEl.setRangeText("  ", codeEl.selectionStart, codeEl.selectionEnd, "end");
          }
          scheduleRender(250);
        }
      });
    }

    if ($("gen")) $("gen").onclick = () => generate($("prompt") ? $("prompt").value : "");
    if ($("prompt")) {
      $("prompt").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate($("prompt").value); }
      });
    }
    document.querySelectorAll("[data-p]").forEach((btn) => {
      btn.onclick = () => generate(btn.getAttribute("data-p"));
    });

    if ($("cfg")) $("cfg").onclick = openCfg;
    if ($("cancel")) $("cancel").onclick = () => { if ($("dlg")) $("dlg").close(); };
    if ($("ok")) $("ok").onclick = () => {
      if ($("key")) S.key = $("key").value.trim();
      if ($("base")) S.base = $("base").value.trim().replace(/\/+$/, "") || DEFAULT_STATE.base;
      if ($("model")) S.model = $("model").value.trim() || DEFAULT_STATE.model;
      persist();
      if ($("dlg")) $("dlg").close();
      toast("Settings saved", "success");
    };

    if ($("open")) $("open").onclick = () => { if ($("file")) $("file").click(); };
    if ($("file")) {
      $("file").onchange = async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try {
          let text = await f.text();
          text = text.replace(/^```(?:mermaid)?\s*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim();
          newDoc(f.name.replace(/\.[^/.]+$/, ""), text);
        } catch { toast("Failed to read file", "error"); }
        e.target.value = "";
      };
    }
    if ($("save")) $("save").onclick = saveMmd;
    if ($("copy")) $("copy").onclick = copyCode;
    if ($("share")) $("share").onclick = shareLink;
    if ($("svg")) $("svg").onclick = exportSVG;
    if ($("png")) $("png").onclick = exportPNG;

    const syncTheme = () => {
      if ($("theme")) { $("theme").value = S.theme; }
    };
    for (const k of ["theme", "look"]) {
      const el = $(k);
      if (el) {
        el.value = S[k];
        el.addEventListener("change", (e) => { S[k] = e.target.value; persist(); scheduleRender(50); });
      }
    }
    for (const k of ["c1", "c2", "c3", "c4"]) {
      const el = $(k);
      if (el) {
        el.value = S[k];
        el.addEventListener("input", (e) => {
          S[k] = e.target.value;
          if (S.theme !== "base") { S.theme = "base"; if ($("theme")) $("theme").value = "base"; }
          persist(); scheduleRender(150);
        });
      }
    }
    const fontEl = $("font");
    if (fontEl) {
      fontEl.value = S.font || "";
      fontEl.addEventListener("input", (e) => { S.font = e.target.value; persist(); scheduleRender(300); });
    }

    if ($("drag-mode")) $("drag-mode").onclick = toggleDragMode;
    if ($("reset-layout")) $("reset-layout").onclick = resetLayout;

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveMmd(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if ($("prompt") && $("prompt").value.trim()) generate($("prompt").value);
        else render();
      }
    });

    window.addEventListener("resize", () => { needFit = true; scheduleRender(120); });
  }

  function boot() {
    loadSavedState();
    bindControls();
    initViewport();
    checkHash();
    loadDoc();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();