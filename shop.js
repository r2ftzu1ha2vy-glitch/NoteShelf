// =====================================
// NOTESHELF SHOP — avatar frames + game frames
// Loaded after script.js. Uses its globals: db, me(), myAvatar(), COIN_ICON,
// updateCoinBadge(), showCoinToast().
//
// Data layout in Firebase (all under users/<name>/):
//   xp                      coin balance (existing)
//   cosmetics/owned/<id>    purchase timestamp
//   cosmetics/avatarFrame   equipped avatar-frame id
//   cosmetics/gameFrame     equipped game-frame id
// =====================================
(function () {
  "use strict";

  // ───────────────────────────────────
  // CATALOG — prices are design choices, tune freely.
  // Daily quests pay 5 coins each (3 per day), so 25–1000 spans
  // "a few days" to "a few weeks" of quests.
  // ───────────────────────────────────
  const RARITY = {
    common:    { label: "Common",    color: "#B8B2A0" },
    uncommon:  { label: "Uncommon",  color: "#5FD08A" },
    rare:      { label: "Rare",      color: "#5DA9FF" },
    epic:      { label: "Epic",      color: "#C77DFF" },
    legendary: { label: "Legendary", color: "#FFD700" },
  };

  // c1/c2: two-tone ring used on <img> avatars (box-shadow only).
  // ring: gradient painted behind round <div> avatars. anim: "spin" | "pulse" | null.
  const AVATAR_FRAMES = [
    { id: "bronze_ring", name: "Bronze Ring",  price: 25,   rarity: "common",   c1: "#CD7F32", c2: "#7A4A1E", glow: "rgba(205,127,50,.45)",  ring: "linear-gradient(135deg,#E3A15B,#7A4A1E)" },
    { id: "silver_ring", name: "Silver Ring",  price: 50,   rarity: "common",   c1: "#D8DCE2", c2: "#7C828C", glow: "rgba(216,220,226,.4)",  ring: "linear-gradient(135deg,#F4F6F8,#7C828C)" },
    { id: "gold_ring",   name: "Gold Ring",    price: 100,  rarity: "uncommon", c1: "#FFD700", c2: "#B8860B", glow: "rgba(255,215,0,.5)",    ring: "linear-gradient(135deg,#FFE680,#FFD700 45%,#B8860B)" },
    { id: "emerald",     name: "Emerald",      price: 150,  rarity: "uncommon", c1: "#3DDC84", c2: "#0B6B3A", glow: "rgba(61,220,132,.5)",   ring: "linear-gradient(135deg,#7CF2B0,#0B6B3A)" },
    { id: "neon_pulse",  name: "Neon Pulse",   price: 250,  rarity: "rare",     c1: "#00F0FF", c2: "#FF2BD6", glow: "rgba(0,240,255,.7)",    ring: "linear-gradient(135deg,#00F0FF,#FF2BD6)", anim: "pulse" },
    { id: "frost",       name: "Frostbite",    price: 250,  rarity: "rare",     c1: "#BFE9FF", c2: "#4FA3D9", glow: "rgba(150,210,255,.6)",  ring: "linear-gradient(135deg,#F2FBFF,#4FA3D9)", anim: "pulse" },
    { id: "ember",       name: "Ember",        price: 400,  rarity: "epic",     c1: "#FF8A00", c2: "#B71C00", glow: "rgba(255,110,0,.65)",   ring: "conic-gradient(#FF3D00,#FFB300,#FF3D00,#7A1200,#FF3D00)", anim: "spin" },
    { id: "rainbow",     name: "Prism",        price: 600,  rarity: "epic",     c1: "#FF5EA8", c2: "#5E9BFF", glow: "rgba(200,120,255,.55)", ring: "conic-gradient(#ff3b3b,#ffd23b,#3bff6e,#3bd8ff,#7a3bff,#ff3bd8,#ff3b3b)", anim: "spin" },
    { id: "void_crown",  name: "Void Crown",   price: 1000, rarity: "legendary",c1: "#C77DFF", c2: "#FFD700", glow: "rgba(170,90,255,.75)",  ring: "conic-gradient(#2a0a4a,#C77DFF,#FFD700,#C77DFF,#2a0a4a)", anim: "spin" },
  ];

  // bg: gradient drawn in the border area around the game iframe.
  // w: border width in px. anim: "slide" animates the gradient (needs size 300%).
  const GAME_FRAMES = [
    { id: "gold_classic",  name: "Gilded Classic", price: 40,  rarity: "common",   w: 5,  bg: "linear-gradient(135deg,#FFE680,#B8860B,#FFE680)", glow: "rgba(255,215,0,.35)" },
    { id: "retro_console", name: "Retro Console",  price: 120, rarity: "uncommon", w: 10, bg: "linear-gradient(180deg,#DDD8CB,#9A9588 50%,#DDD8CB)", glow: "rgba(0,0,0,0)" },
    { id: "crimson_edge",  name: "Crimson Edge",   price: 200, rarity: "uncommon", w: 5,  bg: "linear-gradient(135deg,#FF4D4D,#7A0000,#FF4D4D)", glow: "rgba(255,60,60,.4)" },
    { id: "pixel_dungeon", name: "Pixel Dungeon",  price: 250, rarity: "rare",     w: 8,  bg: "repeating-conic-gradient(#3A2A1A 0 25%,#7A5A2E 0 50%)", size: "16px 16px", glow: "rgba(0,0,0,0)" },
    { id: "neon_arcade",   name: "Neon Arcade",    price: 300, rarity: "rare",     w: 5,  bg: "linear-gradient(90deg,#00F0FF,#FF2BD6,#7B2CFF,#00F0FF)", size: "300% 100%", anim: "slide", glow: "rgba(0,240,255,.55)" },
    { id: "aurora",        name: "Aurora",         price: 450, rarity: "epic",     w: 6,  bg: "linear-gradient(120deg,#00FFA3,#03A9F4,#A855F7,#00FFA3)", size: "300% 100%", anim: "slide", glow: "rgba(3,169,244,.5)" },
    { id: "royal_holo",    name: "Royal Holo",     price: 800, rarity: "legendary",w: 7,  bg: "linear-gradient(115deg,#FFD700,#FFF6C2,#C77DFF,#5DA9FF,#FFD700)", size: "300% 100%", anim: "slide", glow: "rgba(255,215,0,.6)" },
  ];

  const KINDS = {
    avatar: { field: "avatarFrame", items: AVATAR_FRAMES, tab: "Avatar Frames" },
    game:   { field: "gameFrame",   items: GAME_FRAMES,   tab: "Game Frames"   },
  };

  function findItem(kind, id) {
    const k = KINDS[kind];
    if (!k || typeof id !== "string") return null;
    return k.items.find(i => i.id === id) || null;
  }

  // ───────────────────────────────────
  // CORE — pure of the DOM, db injected so it can be tested in Node
  // ───────────────────────────────────
  const core = {
    cosPath: (user) => "users/" + user + "/cosmetics",

    // Only frames that exist in the catalog AND are owned count as equipped.
    // Anything else (stale id, hand-edited node) renders as no frame.
    sanitize(raw) {
      const v = raw && typeof raw === "object" ? raw : {};
      const owned = v.owned && typeof v.owned === "object" ? v.owned : {};
      const pick = (kind) => {
        const id = v[KINDS[kind].field];
        return findItem(kind, id) && owned[id] ? id : null;
      };
      return { owned, avatarFrame: pick("avatar"), gameFrame: pick("game") };
    },

    // Deduct the price atomically, then record ownership. If the ownership
    // write fails the price is refunded.
    async buy(db, user, kind, id) {
      const item = findItem(kind, id);
      if (!user)  return { ok: false, reason: "login" };
      if (!item)  return { ok: false, reason: "unknown" };
      const ownedRef = db.ref(core.cosPath(user) + "/owned/" + item.id);
      const xpRef    = db.ref("users/" + user + "/xp");

      let already;
      try { already = (await ownedRef.once("value")).val(); }
      catch (e) { return { ok: false, reason: "error", error: e }; }
      if (already) return { ok: false, reason: "owned" };

      let deducted = false;
      let tx;
      try {
        tx = await xpRef.transaction(cur => {
          deducted = false;
          // First run can see a not-yet-synced null; returning a value (not
          // undefined) makes Firebase re-run with the real server value.
          if (cur === null) return 0;
          if (typeof cur !== "number" || !isFinite(cur) || cur < item.price) return; // abort
          deducted = true;
          return cur - item.price;
        });
      } catch (e) { return { ok: false, reason: "error", error: e }; }

      if (!tx.committed || !deducted) return { ok: false, reason: "insufficient" };
      const balance = tx.snapshot.val();

      try {
        await ownedRef.set(Date.now());
      } catch (e) {
        try { await xpRef.transaction(c => (typeof c === "number" ? c : 0) + item.price); }
        catch (e2) { return { ok: false, reason: "error", error: e, refundFailed: true }; }
        return { ok: false, reason: "error", error: e };
      }
      return { ok: true, balance, item };
    },

    async equip(db, user, kind, id) {
      const k = KINDS[kind];
      if (!user || !k) return { ok: false, reason: "unknown" };
      try {
        if (id === null) {
          await db.ref(core.cosPath(user) + "/" + k.field).remove();
          return { ok: true };
        }
        if (!findItem(kind, id)) return { ok: false, reason: "unknown" };
        const owned = (await db.ref(core.cosPath(user) + "/owned/" + id).once("value")).val();
        if (!owned) return { ok: false, reason: "not_owned" };
        await db.ref(core.cosPath(user) + "/" + k.field).set(id);
        return { ok: true };
      } catch (e) { return { ok: false, reason: "error", error: e }; }
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { core, AVATAR_FRAMES, GAME_FRAMES, findItem };
  }
  if (typeof document === "undefined") return; // Node test run: stop before any UI

  // ───────────────────────────────────
  // STYLES (generated from the catalog so there is one source of truth)
  // ───────────────────────────────────
  function buildCSS() {
    let css = `
.ns-af { position: relative; isolation: isolate; overflow: visible !important; box-shadow: 0 0 0 1px #0D0B12; }
.ns-af > img { border-radius: 50%; }
.ns-af::before { content: ""; position: absolute; inset: -3px; border-radius: 50%; z-index: -1; pointer-events: none; background: var(--af-ring); box-shadow: 0 0 9px var(--af-glow); }
img.ns-af { box-shadow: 0 0 0 2px var(--af-c1), 0 0 0 4px var(--af-c2), 0 0 10px var(--af-glow); }
@property --gf-p { syntax: '<percentage>'; inherits: false; initial-value: 0%; }
@keyframes nsAfSpin  { to { transform: rotate(360deg); } }
@keyframes nsAfPulse { 0%,100% { opacity: .75; box-shadow: 0 0 5px var(--af-glow); } 50% { opacity: 1; box-shadow: 0 0 14px var(--af-glow); } }
@keyframes nsGfSlide { from { --gf-p: 0%; } to { --gf-p: 100%; } }
#game-frame-main[data-gf], .ns-gf-prev[data-gf] {
  box-sizing: border-box;
  border: var(--gf-w, 6px) solid transparent !important;
  background: linear-gradient(#000,#000) padding-box, var(--gf-bg) border-box !important;
  background-size: 100% 100%, var(--gf-size, 100% 100%) !important;
  background-position: 0 0, var(--gf-p) 50% !important;
}
@media (prefers-reduced-motion: reduce) {
  .ns-af::before, #game-frame-main[data-gf], .ns-gf-prev[data-gf] { animation: none !important; }
}
`;
    AVATAR_FRAMES.forEach(f => {
      css += `[data-af="${f.id}"] { --af-ring:${f.ring}; --af-c1:${f.c1}; --af-c2:${f.c2}; --af-glow:${f.glow}; }\n`;
      if (f.anim === "spin")  css += `.ns-af[data-af="${f.id}"]::before { animation: nsAfSpin 4s linear infinite; }\n`;
      if (f.anim === "pulse") css += `.ns-af[data-af="${f.id}"]::before { animation: nsAfPulse 2s ease-in-out infinite; }\n`;
    });
    GAME_FRAMES.forEach(f => {
      css += `#game-frame-main[data-gf="${f.id}"], .ns-gf-prev[data-gf="${f.id}"] { --gf-bg:${f.bg}; --gf-w:${f.w}px; --gf-size:${f.size || "100% 100%"}; box-shadow: 0 0 14px ${f.glow}; }\n`;
      if (f.anim === "slide") css += `#game-frame-main[data-gf="${f.id}"], .ns-gf-prev[data-gf="${f.id}"] { animation: nsGfSlide 6s linear infinite alternate; }\n`;
    });

    css += `
#ns-shop-overlay { position: fixed; inset: 0; z-index: 10001; background: rgba(4,3,8,.78); backdrop-filter: blur(3px);
  display: none; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; }
#ns-shop-overlay.open { display: flex; animation: nsShopIn .22s ease; }
@keyframes nsShopIn { from { opacity: 0; } to { opacity: 1; } }
#ns-shop { width: min(780px, 100%); max-height: min(86vh, 100%); display: flex; flex-direction: column;
  background: linear-gradient(160deg,#141219,#0D0B12); border: 1px solid rgba(184,150,12,.5); border-radius: 18px;
  box-shadow: 0 24px 80px rgba(0,0,0,.9); overflow: hidden; font-family: 'Cinzel', serif; color: #F0E6CA; }
#ns-shop-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px;
  background: linear-gradient(135deg, rgba(255,215,0,.08), rgba(255,215,0,.02)); border-bottom: 1px solid rgba(255,215,0,.12); flex-shrink: 0; }
#ns-shop-title { font-size: 13px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #FFD700; display: flex; align-items: center; gap: 8px; }
#ns-shop-balance { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; letter-spacing: 1px; color: #FFD700;
  background: rgba(255,215,0,.07); border: 1px solid rgba(184,150,12,.45); border-radius: 20px; padding: 5px 12px; }
#ns-shop-balance .coin-svg { font-size: 17px; }
#ns-shop-close { width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(184,150,12,.35); background: transparent; color: #B8960C; cursor: pointer; display: flex; align-items: center; justify-content: center; }
#ns-shop-close:hover { color: #FFD700; border-color: #FFD700; }
#ns-shop-tabs { display: flex; border-bottom: 1px solid rgba(255,215,0,.08); flex-shrink: 0; }
.ns-shop-tab { flex: 1; padding: 10px 0; font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
  color: #B8960C; background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; opacity: .65; }
.ns-shop-tab:hover { opacity: 1; color: #FFD700; }
.ns-shop-tab.active { opacity: 1; color: #FFD700; border-bottom-color: #FFD700; background: rgba(255,215,0,.03); }
#ns-shop-grid { flex: 1; overflow-y: auto; padding: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
#ns-shop-grid::-webkit-scrollbar { width: 4px; }
#ns-shop-grid::-webkit-scrollbar-thumb { background: rgba(184,150,12,.4); border-radius: 2px; }
.ns-shop-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 10px 12px; text-align: center;
  background: rgba(255,215,0,.025); border: 1px solid rgba(184,150,12,.22); border-radius: 12px; }
.ns-shop-card.equipped { border-color: rgba(255,215,0,.7); box-shadow: 0 0 16px rgba(255,215,0,.12); }
.ns-shop-prev { height: 76px; display: flex; align-items: center; justify-content: center; width: 100%; }
.ns-shop-av { width: 52px; height: 52px; border-radius: 50%; background: #1C1924; display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: #B8960C; }
.ns-shop-av img { width: 100%; height: 100%; object-fit: cover; }
.ns-gf-prev { width: 100%; max-width: 128px; aspect-ratio: 16/9; border-radius: 4px; background: #000; }
.ns-shop-name { font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #F0E6CA; }
.ns-shop-rarity { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; }
.ns-shop-price { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #FFD700; }
.ns-shop-price .coin-svg { font-size: 15px; }
.ns-shop-btn { width: 100%; padding: 7px 0; font-family: 'Cinzel', serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
  border-radius: 8px; border: 1px solid rgba(184,150,12,.55); background: rgba(255,215,0,.08); color: #FFD700; cursor: pointer; }
.ns-shop-btn:hover:not(:disabled) { background: #FFD700; color: #07060A; }
.ns-shop-btn:disabled { opacity: .4; cursor: not-allowed; }
.ns-shop-btn.on { background: rgba(255,215,0,.18); }
#ns-shop-foot { padding: 8px 16px; font-family: 'EB Garamond', serif; font-style: italic; font-size: 12px; color: #B8960C; opacity: .7; text-align: center; flex-shrink: 0; border-top: 1px solid rgba(255,215,0,.06); }
#shop-btn .coin-svg { font-size: 13px; }
#ns-coin-badge { cursor: pointer; }
`;
    return css;
  }

  // ───────────────────────────────────
  // STATE + FRAME RENDERING
  // ───────────────────────────────────
  const state = { owned: {}, avatarFrame: null, gameFrame: null, busy: false, tab: "avatar", open: false };
  let cosRef = null;
  let xpRef = null;
  const otherCache = new Map(); // username -> { t, p: Promise<{avatarFrame}> }
  const OTHER_TTL = 60000;

  function setAvatarFrame(el, id) {
    if (id && findItem("avatar", id)) {
      el.classList.add("ns-af");
      el.dataset.af = id;
    } else {
      el.classList.remove("ns-af");
      delete el.dataset.af;
    }
  }

  // Called from script.js wherever an avatar element is built.
  function decorateAvatar(el, username) {
    if (!el || !username) return;
    el.dataset.afUser = username;
    if (username === me()) { setAvatarFrame(el, state.avatarFrame); return; }
    const hit = otherCache.get(username);
    const p = hit && Date.now() - hit.t < OTHER_TTL
      ? hit.p
      : db.ref(core.cosPath(username)).once("value").then(s => core.sanitize(s.val())).catch(() => core.sanitize(null));
    if (!hit || p !== hit.p) otherCache.set(username, { t: Date.now(), p });
    p.then(c => { if (el.dataset.afUser === username) setAvatarFrame(el, c.avatarFrame); });
  }

  function refreshOwnAvatars() {
    const user = me();
    if (!user) return;
    document.querySelectorAll("[data-af-user]").forEach(el => {
      if (el.dataset.afUser === user) setAvatarFrame(el, state.avatarFrame);
    });
    const topAv = document.getElementById("user-avatar");
    if (topAv) setAvatarFrame(topAv, user ? state.avatarFrame : null);
  }

  function applyGameFrame() {
    const f = document.getElementById("game-frame-main");
    if (!f) return;
    if (state.gameFrame) f.setAttribute("data-gf", state.gameFrame);
    else f.removeAttribute("data-gf");
  }

  function resetState() {
    state.owned = {}; state.avatarFrame = null; state.gameFrame = null;
    document.querySelectorAll("[data-af-user]").forEach(el => setAvatarFrame(el, null));
    const topAv = document.getElementById("user-avatar");
    if (topAv) setAvatarFrame(topAv, null);
    applyGameFrame();
  }

  function attachSelf(user) {
    detachSelf();
    if (!user) return;
    cosRef = db.ref(core.cosPath(user));
    cosRef.on("value", snap => {
      if (me() !== user) return;
      const c = core.sanitize(snap.val());
      state.owned = c.owned; state.avatarFrame = c.avatarFrame; state.gameFrame = c.gameFrame;
      otherCache.delete(user);
      refreshOwnAvatars();
      applyGameFrame();
      if (state.open) render();
    }, err => console.warn("[shop] cosmetics listener failed:", err && err.message));
  }
  function detachSelf() {
    if (cosRef) { cosRef.off(); cosRef = null; }
    detachBalance();
  }

  function attachBalance(user) {
    detachBalance();
    xpRef = db.ref("users/" + user + "/xp");
    xpRef.on("value", snap => {
      const v = snap.val();
      const bal = typeof v === "number" && isFinite(v) ? v : 0;
      window.__ns_userCoins = bal;
      if (typeof updateCoinBadge === "function") updateCoinBadge(bal);
      if (state.open) render(); // button states (Buy / Need N more) depend on the balance
    });
  }
  function detachBalance() { if (xpRef) { xpRef.off(); xpRef = null; } }

  // ───────────────────────────────────
  // UI
  // ───────────────────────────────────
  let overlay, gridEl, balEl, tabEls, footEl;

  function el(tag, props, kids) {
    const n = document.createElement(tag);
    if (props) Object.keys(props).forEach(k => {
      if (k === "text") n.textContent = props[k];
      else if (k === "class") n.className = props[k];
      else if (k === "html") n.innerHTML = props[k]; // trusted constants only (COIN_ICON, SVG)
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(c => c && n.appendChild(c));
    return n;
  }

  function buildModal() {
    overlay = el("div", { id: "ns-shop-overlay" });
    const modal = el("div", { id: "ns-shop", role: "dialog", "aria-modal": "true", "aria-label": "Shop" });

    const title = el("div", { id: "ns-shop-title", html:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' });
    title.appendChild(document.createTextNode("Shop"));
    balEl = el("div", { id: "ns-shop-balance" });
    const close = el("button", { id: "ns-shop-close", "aria-label": "Close shop", html:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' });
    close.onclick = closeShop;
    modal.appendChild(el("div", { id: "ns-shop-head" }, [title, balEl, close]));

    const tabs = el("div", { id: "ns-shop-tabs" });
    tabEls = {};
    Object.keys(KINDS).forEach(kind => {
      const b = el("button", { class: "ns-shop-tab", text: KINDS[kind].tab });
      b.onclick = () => { state.tab = kind; render(); };
      tabEls[kind] = b;
      tabs.appendChild(b);
    });
    modal.appendChild(tabs);

    gridEl = el("div", { id: "ns-shop-grid" });
    modal.appendChild(gridEl);
    footEl = el("div", { id: "ns-shop-foot", text: "Frames are cosmetic. Other players see your equipped avatar frame in chat." });
    modal.appendChild(footEl);

    overlay.appendChild(modal);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeShop(); });
    document.body.appendChild(overlay);
  }

  function renderBalance() {
    balEl.innerHTML = COIN_ICON + "<span></span>";
    balEl.lastChild.textContent = (window.__ns_userCoins || 0).toLocaleString();
  }

  function previewNode(kind, item) {
    if (kind === "avatar") {
      const av = el("div", { class: "ns-shop-av" });
      const url = myAvatar();
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        img.style.borderRadius = "50%";
        img.onerror = () => { img.remove(); av.textContent = (me() || "?").charAt(0).toUpperCase(); };
        av.appendChild(img);
      } else {
        av.textContent = (me() || "?").charAt(0).toUpperCase();
      }
      setAvatarFrame(av, item.id);
      return av;
    }
    const g = el("div", { class: "ns-gf-prev" });
    g.setAttribute("data-gf", item.id);
    return g;
  }

  function cardFor(kind, item) {
    const k = KINDS[kind];
    const owned = !!state.owned[item.id];
    const equipped = state[k.field] === item.id;
    const card = el("div", { class: "ns-shop-card" + (equipped ? " equipped" : "") });

    card.appendChild(el("div", { class: "ns-shop-prev" }, [previewNode(kind, item)]));
    card.appendChild(el("div", { class: "ns-shop-name", text: item.name }));
    const r = RARITY[item.rarity];
    const rar = el("div", { class: "ns-shop-rarity", text: r.label });
    rar.style.color = r.color;
    card.appendChild(rar);

    const btn = el("button", { class: "ns-shop-btn" });
    if (owned) {
      btn.textContent = equipped ? "Equipped ✓" : "Equip";
      if (equipped) btn.classList.add("on");
      btn.onclick = () => doEquip(kind, equipped ? null : item.id);
    } else {
      card.appendChild(el("div", { class: "ns-shop-price", html: COIN_ICON + "<span>" + item.price.toLocaleString() + "</span>" }));
      const bal = window.__ns_userCoins || 0;
      if (bal < item.price) {
        btn.textContent = "Need " + (item.price - bal).toLocaleString() + " more";
        btn.disabled = true;
      } else {
        btn.textContent = "Buy";
        btn.onclick = () => doBuy(kind, item);
      }
    }
    if (state.busy) btn.disabled = true;
    card.appendChild(btn);
    return card;
  }

  function render() {
    if (!overlay) return;
    renderBalance();
    Object.keys(tabEls).forEach(k => tabEls[k].classList.toggle("active", k === state.tab));
    gridEl.textContent = "";
    // Owned first, then by price.
    const items = KINDS[state.tab].items.slice().sort((a, b) =>
      (!!state.owned[b.id] - !!state.owned[a.id]) || (a.price - b.price));
    items.forEach(it => gridEl.appendChild(cardFor(state.tab, it)));
  }

  async function doBuy(kind, item) {
    if (state.busy) return;
    state.busy = true; render();
    const res = await core.buy(db, me(), kind, item.id);
    state.busy = false;
    if (res.ok) {
      window.__ns_userCoins = res.balance;
      if (typeof updateCoinBadge === "function") updateCoinBadge(res.balance);
      state.owned[item.id] = Date.now();
      showCoinToast("Bought " + item.name + "  ·  −" + item.price + " " + COIN_ICON);
      // Equip on purchase so the buy feels immediate; failure here is non-fatal.
      await doEquip(kind, item.id, true);
    } else {
      const msg = {
        insufficient: "Not enough coins",
        owned: "You already own this",
        login: "Log in to shop",
        unknown: "Unknown item",
        error: res.refundFailed ? "Purchase failed — check your balance and contact a mod" : "Purchase failed — you were not charged",
      }[res.reason] || "Purchase failed";
      showCoinToast("⚠ " + msg);
      if (res.error) console.warn("[shop] buy failed:", res.error);
    }
    render();
  }

  async function doEquip(kind, id, quiet) {
    if (state.busy && !quiet) return;
    const res = await core.equip(db, me(), kind, id);
    if (!res.ok && !quiet) showCoinToast("⚠ Could not equip");
    if (res.error) console.warn("[shop] equip failed:", res.error);
    render();
  }

  function openShop() {
    const user = me();
    if (!user) { const lb = document.getElementById("login-btn"); if (lb) lb.click(); return; }
    if (!overlay) buildModal();
    state.open = true;
    attachBalance(user);
    overlay.classList.add("open");
    render();
  }
  function closeShop() {
    state.open = false;
    detachBalance();
    if (overlay) overlay.classList.remove("open");
  }

  // ───────────────────────────────────
  // WIRING
  // ───────────────────────────────────
  function addShopButton() {
    if (document.getElementById("shop-btn")) return;
    const bar = document.getElementById("top-bar");
    if (!bar) return;
    const btn = el("button", { id: "shop-btn", class: "top-btn", html: COIN_ICON });
    btn.style.display = me() ? "" : "none";
    btn.appendChild(document.createTextNode(" Shop"));
    btn.onclick = openShop;
    const anchor = document.getElementById("edit-profile-btn");
    if (anchor && anchor.parentNode === bar) bar.insertBefore(btn, anchor.nextSibling);
    else bar.appendChild(btn);
  }
  function setShopButtonVisible(v) {
    const b = document.getElementById("shop-btn");
    if (b) b.style.display = v ? "" : "none";
  }

  function init() {
    const st = document.createElement("style");
    st.id = "ns-shop-styles";
    st.textContent = buildCSS();
    document.head.appendChild(st);

    addShopButton();
    applyGameFrame();

    // Clicking the coin badge opens the shop.
    document.addEventListener("click", e => {
      if (e.target.closest && e.target.closest("#ns-coin-badge")) openShop();
    });
    // Escape closes the shop first, before script.js's handler can close the game viewer.
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && state.open) { e.stopPropagation(); closeShop(); }
    }, true);

    window.addEventListener("ns_login", e => {
      const u = (e.detail && e.detail.username) || me();
      setShopButtonVisible(true);
      attachSelf(u);
    });
    window.addEventListener("ns_logout", () => {
      closeShop();
      detachSelf();
      resetState();
      setShopButtonVisible(false);
    });
    if (me()) attachSelf(me());
  }

  window.NSShop = { decorateAvatar, open: openShop, close: closeShop, core, AVATAR_FRAMES, GAME_FRAMES };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
