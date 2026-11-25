// =====================================
// NOTESHELF SHOP — frame crates (avatar + game-button frames)
// Loaded after script.js. Uses its globals: db, me(), myAvatar(), COIN_ICON,
// updateCoinBadge(), showCoinToast(), and (for previews only) games[].
//
// Data layout in Firebase (all under users/<name>/):
//   xp                      coin balance (existing)
//   cosmetics/owned/<id>    unlock timestamp (same node as the old shop)
//   cosmetics/avatarFrame   equipped avatar-frame id
//   cosmetics/gameFrame     equipped game-frame id (drawn on the game thumbnail buttons)
//
// Frame ids from the previous shop are kept, so frames people already own stay owned.
// =====================================
(function () {
  "use strict";

  // ───────────────────────────────────
  // TUNING — everything about prices, odds and refunds lives here.
  // Daily quests pay 5 coins each (3 per day).
  // Odds are per RARITY: the crate picks a rarity by weight, then a frame of that
  // rarity uniformly. Only rarities that actually exist in a crate are rolled.
  // ───────────────────────────────────
  const RARITY = {
    common:    { label: "Common",    color: "#B8B2A0" },
    uncommon:  { label: "Uncommon",  color: "#5FD08A" },
    rare:      { label: "Rare",      color: "#5DA9FF" },
    epic:      { label: "Epic",      color: "#C77DFF" },
    legendary: { label: "Legendary", color: "#FFD700" },
  };
  const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

  const TIERS = {
    1: { price: 50,  weights: { common: 52, uncommon: 28, rare: 13, epic: 5,  legendary: 2 } },
    2: { price: 150, weights: { common: 38, uncommon: 30, rare: 20, epic: 8,  legendary: 4 } },
    3: { price: 350, weights: {             uncommon: 45, rare: 33, epic: 15, legendary: 7 } },
  };

  // Rolling a frame you already own refunds this share of the crate price.
  const DUPE_REFUND = { common: 0.15, uncommon: 0.25, rare: 0.40, epic: 0.60, legendary: 0.80 };

  const MIN_FRAMES_PER_CRATE = 10;

  const CRATES = [
    { id: "av_foundry",   kind: "avatar", tier: 1, name: "Foundry Crate",        accent: "#E3A15B", blurb: "Forged metals, cut gems and live embers." },
    { id: "av_neon",      kind: "avatar", tier: 2, name: "Neon District Crate",  accent: "#00F0FF", blurb: "Wired-up rings that hum, glitch and overclock." },
    { id: "av_celestial", kind: "avatar", tier: 3, name: "Celestial Crate",      accent: "#C77DFF", blurb: "Moons, auroras and things beyond the sky." },
    { id: "gf_arcade",    kind: "game",   tier: 1, name: "Arcade Crate",         accent: "#FF2BD6", blurb: "Cabinet borders, pixels and high-score glow." },
    { id: "gf_library",   kind: "game",   tier: 2, name: "Gilded Library Crate", accent: "#FFD700", blurb: "Leather, oak and gold leaf fit for a shelf." },
    { id: "gf_mythic",    kind: "game",   tier: 3, name: "Mythic Crate",         accent: "#7B8CFF", blurb: "Elements, dragons and rifts in the sky." },
  ];

  // ───────────────────────────────────
  // FRAME CATALOG
  // ───────────────────────────────────

  // ── Avatar frames ──
  // ring: gradient painted behind round <div> avatars (3px+ ring, ::before).
  // c1/c2/glow: two-tone box-shadow ring used on <img> avatars (no pseudo-elements there).
  // spin/pulse/beat/flicker: animation period in seconds (combinable, except beat+spin).
  // w: ring thickness in px (default 3).
  const AVATAR_FRAMES = [
    // ── Foundry Crate ──
    { id: "bronze_ring",  name: "Bronze Ring",   crate: "av_foundry", rarity: "common",    c1: "#CD7F32", c2: "#7A4A1E", glow: "rgba(205,127,50,.45)",  ring: "linear-gradient(135deg,#E3A15B,#7A4A1E)" },
    { id: "silver_ring",  name: "Silver Ring",   crate: "av_foundry", rarity: "common",    c1: "#D8DCE2", c2: "#7C828C", glow: "rgba(216,220,226,.4)",  ring: "linear-gradient(135deg,#F4F6F8,#7C828C)" },
    { id: "copper_weave", name: "Copper Weave",  crate: "av_foundry", rarity: "common",    c1: "#D2824A", c2: "#5A2E16", glow: "rgba(210,130,74,.4)",   ring: "repeating-conic-gradient(#D2824A 0deg 14deg,#5A2E16 14deg 28deg)" },
    { id: "gold_ring",    name: "Gold Ring",     crate: "av_foundry", rarity: "uncommon",  c1: "#FFD700", c2: "#B8860B", glow: "rgba(255,215,0,.5)",    ring: "conic-gradient(#FFE680,#B8860B,#FFF3B0,#B8860B,#FFE680)", spin: 9 },
    { id: "emerald",      name: "Emerald",       crate: "av_foundry", rarity: "uncommon",  c1: "#3DDC84", c2: "#0B6B3A", glow: "rgba(61,220,132,.5)",   ring: "conic-gradient(#7CF2B0,#0B6B3A,#3DDC84,#0B6B3A,#7CF2B0)" },
    { id: "sapphire",     name: "Sapphire",      crate: "av_foundry", rarity: "uncommon",  c1: "#6F9BFF", c2: "#12286E", glow: "rgba(76,125,255,.5)",   ring: "conic-gradient(#A9C6FF,#12286E,#4C7DFF,#12286E,#A9C6FF)" },
    { id: "ruby_beat",    name: "Ruby Heart",    crate: "av_foundry", rarity: "rare",      c1: "#FF3B55", c2: "#5A0A18", glow: "rgba(255,59,85,.65)",   ring: "conic-gradient(#FF8A99,#8A0F25,#FF3B55,#5A0A18,#FF8A99)", beat: 1.5 },
    { id: "obsidian_edge",name: "Obsidian Edge", crate: "av_foundry", rarity: "rare",      c1: "#FFD700", c2: "#0A0A0F", glow: "rgba(255,215,0,.35)",   ring: "conic-gradient(#0A0A0F 0%,#0A0A0F 55%,#FFD700 72%,#0A0A0F 88%)", spin: 3 },
    { id: "ember",        name: "Ember",         crate: "av_foundry", rarity: "epic",      c1: "#FF8A00", c2: "#B71C00", glow: "rgba(255,110,0,.65)",   ring: "conic-gradient(#FF3D00,#FFB300,#FF3D00,#7A1200,#FF3D00)", spin: 4, pulse: 1.8 },
    { id: "sunforge",     name: "Sunforge",      crate: "av_foundry", rarity: "legendary", c1: "#FFD700", c2: "#FF9A00", glow: "rgba(255,170,0,.85)",   ring: "conic-gradient(#FFF6C2,#FFD700,#FF9A00,#FFD700,#FFF6C2,#FFB300,#FFF6C2)", spin: 2.4, pulse: 1.6, w: 4 },

    // ── Neon District Crate ──
    { id: "scanline",     name: "Scanline",      crate: "av_neon", rarity: "common",    c1: "#00F0FF", c2: "#052E36", glow: "rgba(0,240,255,.45)",   ring: "repeating-linear-gradient(0deg,#00F0FF 0px 2px,#052E36 2px 4px)" },
    { id: "magenta_dash", name: "Magenta Dash",  crate: "av_neon", rarity: "common",    c1: "#FF2BD6", c2: "#3A0A33", glow: "rgba(255,43,214,.45)",  ring: "repeating-conic-gradient(#FF2BD6 0deg 12deg,#0D0B12 12deg 24deg)", spin: 14 },
    { id: "lime_wire",    name: "Lime Wire",     crate: "av_neon", rarity: "common",    c1: "#B6FF3B", c2: "#2B6B00", glow: "rgba(182,255,59,.45)",  ring: "linear-gradient(135deg,#D9FF8A,#B6FF3B 40%,#2B6B00)" },
    { id: "violet_hum",   name: "Violet Hum",    crate: "av_neon", rarity: "uncommon",  c1: "#B38CFF", c2: "#3A1C8C", glow: "rgba(150,100,255,.6)",  ring: "conic-gradient(#D4BEFF,#3A1C8C,#B38CFF,#3A1C8C,#D4BEFF)", pulse: 2.4 },
    { id: "cyber_split",  name: "Cyber Split",   crate: "av_neon", rarity: "uncommon",  c1: "#00F0FF", c2: "#FF2BD6", glow: "rgba(120,120,255,.55)", ring: "conic-gradient(#00F0FF 0% 50%,#FF2BD6 50% 100%)", spin: 6 },
    { id: "glitch",       name: "Glitch",        crate: "av_neon", rarity: "uncommon",  c1: "#00F0FF", c2: "#FF2BD6", glow: "rgba(255,43,214,.6)",   ring: "conic-gradient(#00F0FF 0% 25%,#FF2BD6 25% 50%,#0D0B12 50% 55%,#00F0FF 55% 80%,#FF2BD6 80% 100%)", flicker: 2.6 },
    { id: "neon_pulse",   name: "Neon Pulse",    crate: "av_neon", rarity: "rare",      c1: "#00F0FF", c2: "#FF2BD6", glow: "rgba(0,240,255,.7)",    ring: "conic-gradient(#00F0FF,#FF2BD6,#00F0FF)", pulse: 1.6 },
    { id: "plasma_arc",   name: "Plasma Arc",    crate: "av_neon", rarity: "rare",      c1: "#7B5CFF", c2: "#00F0FF", glow: "rgba(123,92,255,.8)",   ring: "conic-gradient(#0D0B12 0%,#0D0B12 55%,#7B5CFF 78%,#00F0FF 94%,#FFFFFF 99.5%,#0D0B12 100%)", spin: 1.6 },
    { id: "rainbow",      name: "Prism",         crate: "av_neon", rarity: "epic",      c1: "#FF5EA8", c2: "#5E9BFF", glow: "rgba(200,120,255,.55)", ring: "conic-gradient(#ff3b3b,#ffd23b,#3bff6e,#3bd8ff,#7a3bff,#ff3bd8,#ff3b3b)", spin: 4 },
    { id: "overclock",    name: "Overclock",     crate: "av_neon", rarity: "legendary", c1: "#00F0FF", c2: "#FF2BD6", glow: "rgba(0,240,255,.85)",   ring: "conic-gradient(#00F0FF,#7B2CFF,#FF2BD6,#FFD700,#00F0FF)", spin: 1.2, pulse: 1.2, w: 4 },

    // ── Celestial Crate ──
    { id: "moonlit",      name: "Moonlit",       crate: "av_celestial", rarity: "uncommon",  c1: "#E8ECFF", c2: "#5C6AA0", glow: "rgba(200,210,255,.55)", ring: "conic-gradient(#F5F7FF,#8E9BC9,#F5F7FF,#5C6AA0,#F5F7FF)", pulse: 3.5 },
    { id: "stardust",     name: "Stardust",      crate: "av_celestial", rarity: "uncommon",  c1: "#FFE9A8", c2: "#4B3B1A", glow: "rgba(255,230,160,.5)",  ring: "repeating-conic-gradient(#FFE9A8 0deg 3deg,#0D0B12 3deg 15deg)", spin: 22 },
    { id: "dusk",         name: "Dusk",          crate: "av_celestial", rarity: "uncommon",  c1: "#FFB27A", c2: "#3B2A7A", glow: "rgba(210,110,150,.5)",  ring: "linear-gradient(180deg,#FFB27A,#C0508F 55%,#3B2A7A)" },
    { id: "frost",        name: "Frostbite",     crate: "av_celestial", rarity: "rare",      c1: "#BFE9FF", c2: "#4FA3D9", glow: "rgba(150,210,255,.6)",  ring: "conic-gradient(#F2FBFF,#4FA3D9,#BFE9FF,#4FA3D9,#F2FBFF)", pulse: 2, spin: 12 },
    { id: "aurora_ring",  name: "Aurora Veil",   crate: "av_celestial", rarity: "rare",      c1: "#00FFA3", c2: "#A855F7", glow: "rgba(3,169,244,.6)",    ring: "conic-gradient(#00FFA3,#03A9F4,#A855F7,#00FFA3)", spin: 5 },
    { id: "nebula",       name: "Nebula",        crate: "av_celestial", rarity: "rare",      c1: "#FF4FD8", c2: "#4B2BBF", glow: "rgba(180,70,230,.65)",  ring: "conic-gradient(#FF4FD8,#4B2BBF,#1B0A3F,#4B2BBF,#FF4FD8)", spin: 7, pulse: 3 },
    { id: "eclipse",      name: "Eclipse",       crate: "av_celestial", rarity: "epic",      c1: "#FF9A3C", c2: "#0A0612", glow: "rgba(255,154,60,.75)",  ring: "conic-gradient(#0A0612 0%,#0A0612 38%,#FF9A3C 54%,#FFE9B0 62%,#FF9A3C 70%,#0A0612 86%)", spin: 3.2, w: 4 },
    { id: "seraph",       name: "Seraph",        crate: "av_celestial", rarity: "epic",      c1: "#FFFDF0", c2: "#FFD97A", glow: "rgba(255,240,190,.8)",  ring: "repeating-conic-gradient(#FFFDF0 0deg 8deg,#FFD97A 8deg 16deg,#0D0B12 16deg 24deg)", spin: 9, pulse: 2.4, w: 4 },
    { id: "void_crown",   name: "Void Crown",    crate: "av_celestial", rarity: "legendary", c1: "#C77DFF", c2: "#FFD700", glow: "rgba(170,90,255,.75)",  ring: "conic-gradient(#2a0a4a,#C77DFF,#FFD700,#C77DFF,#2a0a4a)", spin: 4, pulse: 2, w: 4 },
    { id: "event_horizon",name: "Event Horizon", crate: "av_celestial", rarity: "legendary", c1: "#7A2BFF", c2: "#000000", glow: "rgba(150,80,255,.9)",   ring: "conic-gradient(#000 0%,#000 30%,#7A2BFF 50%,#FFFFFF 58%,#7A2BFF 66%,#000 82%)", spin: 2.2, pulse: 1.8, w: 5 },
  ];

  // ── Game frames (drawn around the game thumbnail buttons) ──
  // bg: border-ring gradient. w: ring width px. size/pos: optional background-size/position for bg.
  // anim: "slide" (needs a 300%-wide gradient that ends on its first colour) or "spin"
  //       (bg must use `conic-gradient(from var(--gf-a), …)`). dur = seconds.
  // fx*: overlay painted on the ring only — sheen sweep, twinkles, corner studs, flicker, pulse, hazard march.
  const SHEEN = "linear-gradient(110deg,transparent 38%,rgba(255,255,255,.9) 50%,transparent 62%)";
  const tint = (c) => `linear-gradient(${c},${c})`;
  // Corner rivets sit on the ring's centreline where it bends round the 12px corner radius.
  const studs = (c, w) => {
    const off = (12 - (12 - w / 2) * Math.SQRT1_2).toFixed(1), r = (w * 0.7).toFixed(1);
    return [[off + "px", off + "px"], [`calc(100% - ${off}px)`, off + "px"],
            [off + "px", `calc(100% - ${off}px)`], [`calc(100% - ${off}px)`, `calc(100% - ${off}px)`]]
      .map(([x, y]) => `radial-gradient(circle at ${x} ${y},${c} 0,${c} ${r}px,transparent ${(+r + 0.8).toFixed(1)}px)`).join(",");
  };
  const dots = (c, w) => {
    const h = w / 2, r = Math.max(1.2, w * 0.34).toFixed(1);
    const pts = [`18% ${h}px`, `64% ${h}px`, `calc(100% - ${h}px) 36%`, `calc(100% - ${h}px) 78%`,
                 `82% calc(100% - ${h}px)`, `30% calc(100% - ${h}px)`, `${h}px 68%`, `${h}px 22%`];
    return pts.map(p => `radial-gradient(circle at ${p},${c} 0,${c} ${r}px,transparent ${(+r + 0.8).toFixed(1)}px)`).join(",");
  };
  const fxSheen   = (d) => ({ fxbg: SHEEN, fxsize: "300% 100%", fxanim: "Sheen", fxdur: d });
  const fxStuds   = (c) => ({ fxstud: c });
  const fxTwinkle = (c, d) => ({ fxdots: c, fxanim: "Twinkle", fxdur: d });
  const fxFlicker = (c, d) => ({ fxbg: tint(c), fxanim: "Flicker", fxdur: d });
  const fxPulse   = (c, d) => ({ fxbg: tint(c), fxanim: "PulseFx", fxdur: d });

  const GAME_FRAMES = [
    // ── Arcade Crate ──
    { id: "arcade_blue",   name: "Arcade Blue",     crate: "gf_arcade", rarity: "common",    w: 6, bg: "linear-gradient(135deg,#4DA3FF,#1B3F9C 55%,#4DA3FF)", glow: "rgba(77,163,255,.4)", ...fxStuds("#CFE8FF") },
    { id: "hazard_tape",   name: "Hazard Tape",     crate: "gf_arcade", rarity: "common",    w: 6, bg: tint("#17130B"), glow: "rgba(255,212,0,.3)", fxbg: "repeating-linear-gradient(45deg,#FFD400 0px 8px,#17130B 8px 16px)", fxanim: "Hazard", fxdur: 1.4 },
    { id: "pixel_grass",   name: "Pixel Grass",     crate: "gf_arcade", rarity: "common",    w: 8, bg: "repeating-conic-gradient(#2E7D32 0deg 90deg,#5C3D1E 90deg 180deg)", size: "16px 16px", glow: "rgba(0,0,0,0)" },
    { id: "retro_console", name: "Retro Console",   crate: "gf_arcade", rarity: "uncommon",  w: 10, bg: "linear-gradient(180deg,#DDD8CB,#9A9588 50%,#DDD8CB)", glow: "rgba(0,0,0,0)", ...fxStuds("#4A463D") },
    { id: "coin_op",       name: "Coin-Op",         crate: "gf_arcade", rarity: "uncommon",  w: 7, bg: "repeating-linear-gradient(90deg,#FFD700 0px 8px,#B8860B 8px 16px)", glow: "rgba(255,215,0,.4)", ...fxSheen(3.2) },
    { id: "handheld",      name: "Handheld",        crate: "gf_arcade", rarity: "uncommon",  w: 9, bg: "linear-gradient(180deg,#9BBC0F,#306230 50%,#0F380F)", glow: "rgba(155,188,15,.3)", ...fxStuds("#0F380F") },
    { id: "pixel_dungeon", name: "Pixel Dungeon",   crate: "gf_arcade", rarity: "rare",      w: 8, bg: "repeating-conic-gradient(#3A2A1A 0deg 90deg,#7A5A2E 90deg 180deg)", size: "16px 16px", glow: "rgba(255,140,40,.25)", ...fxFlicker("rgba(255,140,40,.5)", 1.8) },
    { id: "neon_arcade",   name: "Neon Arcade",     crate: "gf_arcade", rarity: "rare",      w: 5, bg: "linear-gradient(90deg,#00F0FF,#FF2BD6,#7B2CFF,#00F0FF)", anim: "slide", dur: 6, glow: "rgba(0,240,255,.55)", ...fxSheen(3.6) },
    { id: "high_score",    name: "High Score",      crate: "gf_arcade", rarity: "epic",      w: 6, bg: "linear-gradient(90deg,#FF004D,#FFA300,#FFEC27,#00E436,#29ADFF,#83769C,#FF004D)", anim: "slide", dur: 3.5, glow: "rgba(255,236,39,.4)", ...fxTwinkle("#FFFFFF", 1.6) },
    { id: "insert_coin",   name: "Insert Coin",     crate: "gf_arcade", rarity: "legendary", w: 7, bg: "conic-gradient(from var(--gf-a),#FFF6C2,#FFD700,#B8860B,#FFD700,#FFF6C2)", anim: "spin", dur: 4, glow: "rgba(255,215,0,.75)", ...fxSheen(2.6) },

    // ── Gilded Library Crate ──
    { id: "gold_classic",  name: "Gilded Classic",  crate: "gf_library", rarity: "common",    w: 5, bg: "linear-gradient(135deg,#FFE680,#B8860B,#FFE680)", glow: "rgba(255,215,0,.35)", ...fxStuds("#FFF3B0") },
    { id: "oak_shelf",     name: "Oak Shelf",       crate: "gf_library", rarity: "common",    w: 8, bg: "repeating-linear-gradient(90deg,#8A5A2B 0px 10px,#6E4520 10px 12px,#9A6A38 12px 26px,#6E4520 26px 28px)", glow: "rgba(0,0,0,0)", ...fxStuds("#D9B44A") },
    { id: "parchment",     name: "Parchment",       crate: "gf_library", rarity: "common",    w: 6, bg: "linear-gradient(135deg,#F2E3B8,#D8C08A 50%,#F2E3B8)", glow: "rgba(240,220,160,.25)", ...fxStuds("#8A6B2E") },
    { id: "crimson_edge",  name: "Crimson Edge",    crate: "gf_library", rarity: "uncommon",  w: 5, bg: "linear-gradient(135deg,#FF4D4D,#7A0000,#FF4D4D)", glow: "rgba(255,60,60,.4)", ...fxSheen(3.8) },
    { id: "emerald_leather", name: "Emerald Leather", crate: "gf_library", rarity: "uncommon", w: 7, bg: "linear-gradient(135deg,#1F7A4D,#0B3D26 55%,#1F7A4D)", glow: "rgba(61,220,132,.3)", ...fxStuds("#FFD700") },
    { id: "midnight_ink",  name: "Midnight Ink",    crate: "gf_library", rarity: "uncommon",  w: 6, bg: "linear-gradient(135deg,#1B2A6B,#070B24 55%,#1B2A6B)", glow: "rgba(70,100,255,.35)", ...fxSheen(4.2) },
    { id: "bronze_filigree", name: "Bronze Filigree", crate: "gf_library", rarity: "rare",    w: 9, bg: "repeating-conic-gradient(#CD7F32 0deg 90deg,#6B3E14 90deg 180deg)", size: "18px 18px", glow: "rgba(205,127,50,.4)", ...fxStuds("#FFE0A8") },
    { id: "royal_velvet",  name: "Royal Velvet",    crate: "gf_library", rarity: "rare",      w: 8, bg: "linear-gradient(120deg,#5B1A8C,#9B4BE0,#2A0A4A,#5B1A8C)", anim: "slide", dur: 7, glow: "rgba(170,90,255,.45)", ...fxStuds("#FFD700") },
    { id: "golden_hour",   name: "Golden Hour",     crate: "gf_library", rarity: "epic",      w: 7, bg: "conic-gradient(from var(--gf-a),#FFD27A,#FF8A3C,#C0408F,#FF8A3C,#FFD27A)", anim: "spin", dur: 6, glow: "rgba(255,150,60,.6)", ...fxSheen(3) },
    { id: "royal_holo",    name: "Royal Holo",      crate: "gf_library", rarity: "legendary", w: 7, bg: "linear-gradient(115deg,#FFD700,#FFF6C2,#C77DFF,#5DA9FF,#FFD700)", anim: "slide", dur: 6, glow: "rgba(255,215,0,.6)", ...fxTwinkle("#FFFFFF", 1.4) },

    // ── Mythic Crate ──
    { id: "frostline",     name: "Frostline",       crate: "gf_mythic", rarity: "uncommon",  w: 5, bg: "linear-gradient(135deg,#F2FBFF,#4FA3D9 50%,#BFE9FF)", glow: "rgba(150,210,255,.6)", ...fxSheen(3.4) },
    { id: "verdant_vine",  name: "Verdant Vine",    crate: "gf_mythic", rarity: "uncommon",  w: 7, bg: "repeating-linear-gradient(135deg,#2E7D32 0px 8px,#1B4D1F 8px 16px)", glow: "rgba(76,175,80,.35)", ...fxTwinkle("#B6FF8A", 2.8) },
    { id: "storm_cloud",   name: "Storm Cloud",     crate: "gf_mythic", rarity: "uncommon",  w: 6, bg: "linear-gradient(135deg,#7A8CA3,#2B3547 55%,#7A8CA3)", glow: "rgba(160,190,255,.35)", ...fxFlicker("rgba(200,220,255,.9)", 3.2) },
    { id: "magma_crack",   name: "Magma Crack",     crate: "gf_mythic", rarity: "rare",      w: 7, bg: "repeating-linear-gradient(135deg,#1A0B05 0px 10px,#FF4A00 10px 13px)", glow: "rgba(255,80,0,.55)", ...fxFlicker("rgba(255,120,30,.55)", 1.7) },
    { id: "toxic_slime",   name: "Toxic Slime",     crate: "gf_mythic", rarity: "rare",      w: 7, bg: "linear-gradient(135deg,#B6FF3B,#2B6B00 50%,#B6FF3B)", glow: "rgba(150,255,60,.55)", ...fxPulse("rgba(210,255,120,.75)", 2) },
    { id: "tidal_wave",    name: "Tidal Wave",      crate: "gf_mythic", rarity: "rare",      w: 6, bg: "linear-gradient(90deg,#0077B6,#00B4D8,#90E0EF,#00B4D8,#0077B6)", anim: "slide", dur: 3, glow: "rgba(0,180,216,.5)", ...fxSheen(3.6) },
    { id: "aurora",        name: "Aurora",          crate: "gf_mythic", rarity: "epic",      w: 6, bg: "linear-gradient(120deg,#00FFA3,#03A9F4,#A855F7,#00FFA3)", anim: "slide", dur: 6, glow: "rgba(3,169,244,.5)", ...fxTwinkle("#FFFFFF", 2.2) },
    { id: "starlight",     name: "Starlight",       crate: "gf_mythic", rarity: "epic",      w: 7, bg: "linear-gradient(135deg,#0B1030,#1B1F5C 50%,#0B1030)", glow: "rgba(120,140,255,.5)", ...fxTwinkle("#FFFFFF", 1.5) },
    { id: "dragon_scale",  name: "Dragon Scale",    crate: "gf_mythic", rarity: "legendary", w: 9, bg: "repeating-conic-gradient(rgba(0,0,0,.32) 0deg 90deg,rgba(0,0,0,0) 90deg 180deg),conic-gradient(from var(--gf-a),#FF3B1D,#7A0A00,#FFB300,#7A0A00,#FF3B1D)", size: "14px 14px,100% 100%", anim: "spin", dur: 5, glow: "rgba(255,90,20,.75)", ...fxSheen(2.8) },
    { id: "cosmic_rift",   name: "Cosmic Rift",     crate: "gf_mythic", rarity: "legendary", w: 8, bg: "conic-gradient(from var(--gf-a),#0A0420,#7B2CFF,#00F0FF,#FF2BD6,#0A0420)", anim: "spin", dur: 3.5, glow: "rgba(123,44,255,.8)", ...fxTwinkle("#FFFFFF", 1.2) },
  ];

  const KINDS = {
    avatar: { field: "avatarFrame", items: AVATAR_FRAMES, tab: "Avatar Crates" },
    game:   { field: "gameFrame",   items: GAME_FRAMES,   tab: "Game Crates"   },
  };

  function findItem(kind, id) {
    const k = KINDS[kind];
    if (!k || typeof id !== "string") return null;
    return k.items.find(i => i.id === id) || null;
  }
  function findCrate(id) { return CRATES.find(c => c.id === id) || null; }
  function cratesOf(kind) { return CRATES.filter(c => c.kind === kind); }
  function framesOf(crate) {
    return KINDS[crate.kind].items
      .filter(f => f.crate === crate.id)
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  }
  const crateOf = (item) => findCrate(item.crate);
  const priceOf = (crate) => TIERS[crate.tier].price;

  // ───────────────────────────────────
  // CORE — pure of the DOM, db and rng injected so it can be tested in Node
  // ───────────────────────────────────
  function secureRandom() {
    const c = (typeof globalThis !== "undefined" && globalThis.crypto) || null;
    if (c && c.getRandomValues) {
      const a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }

  const core = {
    cosPath: (user) => "users/" + user + "/cosmetics",

    // Only frames that exist in the catalog AND are owned count as equipped.
    sanitize(raw) {
      const v = raw && typeof raw === "object" ? raw : {};
      const owned = v.owned && typeof v.owned === "object" ? v.owned : {};
      const pick = (kind) => {
        const id = v[KINDS[kind].field];
        return findItem(kind, id) && owned[id] ? id : null;
      };
      return { owned, avatarFrame: pick("avatar"), gameFrame: pick("game") };
    },

    // Rarity -> percent for a crate, normalised over the rarities it actually contains.
    crateOdds(crate) {
      const present = RARITY_ORDER.filter(r => framesOf(crate).some(f => f.rarity === r));
      const w = TIERS[crate.tier].weights;
      const total = present.reduce((s, r) => s + (w[r] || 0), 0);
      return present.map(r => ({ rarity: r, pct: total > 0 ? (100 * (w[r] || 0)) / total : 0 }));
    },

    // Weighted rarity, then uniform frame inside that rarity. rng() must return [0,1).
    rollItem(crate, rng) {
      const pool = framesOf(crate);
      const odds = core.crateOdds(crate).filter(o => o.pct > 0);
      if (!pool.length || !odds.length) return null;
      const total = odds.reduce((s, o) => s + o.pct, 0);
      let x = rng() * total, rarity = odds[odds.length - 1].rarity;
      for (const o of odds) { if (x < o.pct) { rarity = o.rarity; break; } x -= o.pct; }
      const bucket = pool.filter(f => f.rarity === rarity);
      return bucket[Math.min(bucket.length - 1, Math.floor(rng() * bucket.length))];
    },

    refundFor(crate, item) {
      return Math.max(0, Math.floor(priceOf(crate) * (DUPE_REFUND[item.rarity] || 0)));
    },

    // Returns a list of human-readable problems; empty list = catalog is consistent.
    validateCatalog() {
      const bad = [];
      const seen = new Set();
      for (const kind of Object.keys(KINDS)) {
        for (const f of KINDS[kind].items) {
          const tag = kind + ":" + f.id;
          if (seen.has(kind + f.id)) bad.push("duplicate id " + tag);
          seen.add(kind + f.id);
          if (!RARITY[f.rarity]) bad.push(tag + " has unknown rarity");
          const cr = findCrate(f.crate);
          if (!cr) bad.push(tag + " has unknown crate " + f.crate);
          else if (cr.kind !== kind) bad.push(tag + " sits in a crate of the other kind");
          if (kind === "avatar" && !f.ring) bad.push(tag + " has no ring");
          if (kind === "game" && (!f.bg || !(f.w >= 3 && f.w <= 12))) bad.push(tag + " needs bg and w in 3..12");
          if (f.anim === "spin" && f.bg.indexOf("var(--gf-a)") < 0) bad.push(tag + " spins but bg has no var(--gf-a)");
        }
      }
      for (const c of CRATES) {
        const pool = framesOf(c);
        if (!TIERS[c.tier]) { bad.push(c.id + " has unknown tier"); continue; }
        if (pool.length < MIN_FRAMES_PER_CRATE) bad.push(c.id + " has only " + pool.length + " frames");
        for (const f of pool) if (!(TIERS[c.tier].weights[f.rarity] > 0)) bad.push(c.id + ": no odds for " + f.rarity + " (" + f.id + ")");
      }
      return bad;
    },

    // Open one crate:
    //  1) deduct the price atomically,  2) roll,  3) claim ownership atomically,
    //  4) duplicate -> partial refund;  any failure after step 1 refunds in full.
    async open(db, user, crateId, rng) {
      const crate = findCrate(crateId);
      if (!user)  return { ok: false, reason: "login" };
      if (!crate) return { ok: false, reason: "unknown" };
      const price = priceOf(crate);
      const xpRef = db.ref("users/" + user + "/xp");
      const credit = (n) => xpRef.transaction(c => (typeof c === "number" && isFinite(c) ? c : 0) + n);

      let deducted = false, tx;
      try {
        tx = await xpRef.transaction(cur => {
          deducted = false;
          // First run can see a not-yet-synced null; returning a value (not
          // undefined) makes Firebase re-run with the real server value.
          if (cur === null) return 0;
          if (typeof cur !== "number" || !isFinite(cur) || cur < price) return; // abort
          deducted = true;
          return cur - price;
        });
      } catch (e) { return { ok: false, reason: "error", error: e }; }
      if (!tx.committed || !deducted) return { ok: false, reason: "insufficient" };
      let balance = tx.snapshot.val();

      const item = core.rollItem(crate, rng || secureRandom);
      if (!item) {
        try { await credit(price); } catch (e2) { return { ok: false, reason: "error", refundFailed: true }; }
        return { ok: false, reason: "error" };
      }

      let wrote = false, claim;
      try {
        claim = await db.ref(core.cosPath(user) + "/owned/" + item.id).transaction(cur => {
          wrote = false;
          if (cur) return; // already owned -> abort, this roll is a duplicate
          wrote = true;
          return Date.now();
        });
      } catch (e) {
        try { await credit(price); } catch (e2) { return { ok: false, reason: "error", error: e, refundFailed: true }; }
        return { ok: false, reason: "error", error: e };
      }
      const isNew = !!(claim.committed && wrote);
      if (isNew) return { ok: true, crate, item, duplicate: false, refund: 0, balance };

      const refund = core.refundFor(crate, item);
      if (refund > 0) {
        try { const r = await credit(refund); balance = r.snapshot.val(); }
        catch (e) { return { ok: true, crate, item, duplicate: true, refund: 0, refundFailed: true, balance }; }
      }
      return { ok: true, crate, item, duplicate: true, refund, balance };
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
    module.exports = { core, CRATES, AVATAR_FRAMES, GAME_FRAMES, TIERS, DUPE_REFUND, findItem, findCrate, framesOf, cratesOf };
  }
  if (typeof document === "undefined") return; // Node test run: stop before any UI

  // ───────────────────────────────────
  // STYLES (generated from the catalog so there is one source of truth)
  // ───────────────────────────────────
  function avatarAnim(f) {
    const a = [];
    if (f.spin)    a.push(`nsAfSpin ${f.spin}s linear infinite`);
    if (f.pulse)   a.push(`nsAfPulse ${f.pulse}s ease-in-out infinite`);
    if (f.beat)    a.push(`nsAfBeat ${f.beat}s ease-in-out infinite`);
    if (f.flicker) a.push(`nsAfFlicker ${f.flicker}s steps(1,end) infinite`);
    return a.join(",");
  }

  function buildCSS() {
    let css = `
/* ── avatar frames ── */
.ns-af { position: relative; isolation: isolate; overflow: visible !important; box-shadow: 0 0 0 1px #0D0B12, 0 0 11px 1px var(--af-glow, transparent); }
.ns-af > img { border-radius: 50%; }
.ns-af::before { content: ""; position: absolute; inset: calc(-1 * var(--af-w, 3px)); padding: var(--af-w, 3px); border-radius: 50%; z-index: -1; pointer-events: none; background: var(--af-ring);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
img.ns-af { box-shadow: 0 0 0 2px var(--af-c1), 0 0 0 4px var(--af-c2), 0 0 10px var(--af-glow); }
@keyframes nsAfSpin    { to { transform: rotate(360deg); } }
@keyframes nsAfPulse   { 0%,100% { opacity: .6; } 50% { opacity: 1; } }
@keyframes nsAfGlow    { 0%,100% { box-shadow: 0 0 0 1px #0D0B12, 0 0 5px 0 var(--af-glow); } 50% { box-shadow: 0 0 0 1px #0D0B12, 0 0 17px 3px var(--af-glow); } }
@keyframes nsAfBeat    { 0%,100% { transform: scale(1); } 14% { transform: scale(1.09); } 28% { transform: scale(1); } 42% { transform: scale(1.06); } 56% { transform: scale(1); } }
@keyframes nsAfFlicker { 0%,100% { opacity: 1; } 8% { opacity: .35; } 10% { opacity: 1; } 52% { opacity: .55; } 54% { opacity: 1; } 78% { opacity: .3; } 80% { opacity: 1; } }

/* ── game frames: set on <html data-gfv> for the real buttons, on .ns-gf-prev in the shop ── */
@property --gf-p { syntax: '<percentage>'; inherits: false; initial-value: 0%; }
@property --gf-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes nsGfSlide   { from { --gf-p: 0%; } to { --gf-p: 100%; } }
@keyframes nsGfSpin    { to { --gf-a: 360deg; } }
@keyframes nsGfSheen   { 0% { background-position: 100% 0; } 55%,100% { background-position: 0 0; } }
@keyframes nsGfTwinkle { 0%,100% { opacity: .2; } 50% { opacity: 1; } }
@keyframes nsGfPulse   { 0%,100% { opacity: 0; } 50% { opacity: .85; } }
@keyframes nsGfFlicker { 0%,100% { opacity: .15; } 6% { opacity: .9; } 9% { opacity: .2; } 40% { opacity: .5; } 44% { opacity: .1; } 70% { opacity: .8; } 74% { opacity: .25; } }
@keyframes nsGfHazard  { from { background-position: 0 0; } to { background-position: 22.627px 0; } }

html[data-gfv] .game-button::before, .ns-gf-prev::before {
  content: ""; position: absolute; inset: calc(-1 * var(--gf-w, 0px)); padding: var(--gf-w, 0px);
  border-radius: var(--r-md, 12px); pointer-events: none; z-index: 3;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
html[data-gfv] .game-button img, html[data-gfv] .game-button .no-thumb, html[data-gfv] .game-button::after {
  border-radius: max(0px, calc(var(--r-md, 12px) - var(--gf-w, 0px))) !important;
}
.ns-gf-prev { position: relative; flex-shrink: 0; box-sizing: border-box; border-radius: 12px; background: #141219;
  width: var(--pw, 84px); height: calc(var(--pw, 84px) * 1.16); }
.ns-gf-art { position: absolute; inset: 0; overflow: hidden; border-radius: max(0px, calc(12px - var(--gf-w, 0px)));
  background: linear-gradient(160deg,#2A2638,#141219) center / cover no-repeat; }
.ns-gf-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(5,4,10,.9)); }
.ns-gf-lbl { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1; padding: 4px 3px; text-align: center;
  font: 600 calc(var(--pw, 84px) * .09) / 1.2 'Cinzel', serif; letter-spacing: .4px; color: #F0E6CA; }
@media (prefers-reduced-motion: reduce) {
  .ns-af, .ns-af::before, html[data-gfv] .game-button, html[data-gfv] .game-button::before, .ns-gf-prev, .ns-gf-prev::before { animation: none !important; }
}
.ns-reel .ns-af::before, .ns-reel .ns-gf-prev, .ns-reel .ns-gf-prev::before { animation-play-state: paused !important; }
`;

    AVATAR_FRAMES.forEach(f => {
      css += `[data-af="${f.id}"] { --af-ring:${f.ring}; --af-c1:${f.c1}; --af-c2:${f.c2}; --af-glow:${f.glow}; --af-w:${f.w || 3}px; }\n`;
      const an = avatarAnim(f);
      if (an) css += `.ns-af[data-af="${f.id}"]::before { animation:${an}; }\n`;
      if (f.pulse) css += `.ns-af.ns-af[data-af="${f.id}"]:not(img) { animation:nsAfGlow ${f.pulse}s ease-in-out infinite; }\n`;
    });

    GAME_FRAMES.forEach(f => {
      const sel  = `html[data-gfv="${f.id}"] .game-button, .ns-gf-prev[data-gfv="${f.id}"]`;
      const selB = `html[data-gfv="${f.id}"] .game-button::before, .ns-gf-prev[data-gfv="${f.id}"]::before`;
      const selH = `html[data-gfv="${f.id}"] .game-button:hover`;
      const slide = f.anim === "slide";
      const size = f.size || (slide ? "300% 100%" : "100% 100%");
      const pos  = f.pos  || (slide ? "var(--gf-p) 50%" : "0 0");
      let base = `--gf-w:${f.w}px;border:${f.w}px solid transparent !important;`
        + `background:linear-gradient(var(--gf-fill,#141219),var(--gf-fill,#141219)) padding-box,${f.bg} border-box !important;`
        + `background-size:100% 100%,${size} !important;background-position:0 0,${pos} !important;`
        + `box-shadow:0 0 14px ${f.glow} !important;`;
      if (f.anim) base += `animation:${slide ? "nsGfSlide" : "nsGfSpin"} ${f.dur || 6}s linear infinite${slide ? " alternate" : ""};`;
      css += `${sel} { ${base} }\n`;
      css += `${selH} { box-shadow: 0 14px 34px rgba(0,0,0,.6), 0 0 24px ${f.glow} !important; }\n`;
      const fxbg = f.fxbg || (f.fxstud ? studs(f.fxstud, f.w) : f.fxdots ? dots(f.fxdots, f.w) : "");
      if (fxbg) {
        let fx = `background:${fxbg};`;
        if (f.fxsize) fx += `background-size:${f.fxsize};`;
        if (f.fxanim) fx += `animation:nsGf${f.fxanim} ${f.fxdur || 3}s ${f.fxanim === "Sheen" || f.fxanim === "Hazard" ? "linear" : "ease-in-out"} infinite;`;
        css += `${selB} { ${fx} }\n`;
      }
    });

    css += `
/* ── shop modal ── */
#ns-shop-overlay { position: fixed; inset: 0; z-index: 10001; background: rgba(4,3,8,.78); backdrop-filter: blur(3px);
  display: none; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; }
#ns-shop-overlay.open { display: flex; animation: nsShopIn .22s ease; }
@keyframes nsShopIn { from { opacity: 0; } to { opacity: 1; } }
#ns-shop { position: relative; width: min(860px, 100%); max-height: min(90vh, 100%); display: flex; flex-direction: column;
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
#ns-shop-grid { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 18px; }
#ns-shop-grid::-webkit-scrollbar { width: 4px; }
#ns-shop-grid::-webkit-scrollbar-thumb { background: rgba(184,150,12,.4); border-radius: 2px; }

.ns-crate { border: 1px solid color-mix(in srgb, var(--cr, #FFD700) 38%, transparent); border-radius: 14px; overflow: hidden;
  background: linear-gradient(160deg, color-mix(in srgb, var(--cr, #FFD700) 8%, #141219), #0F0D15); }
.ns-crate-head { display: flex; align-items: center; gap: 14px; padding: 14px; flex-wrap: wrap; }
.ns-crate-ico { flex-shrink: 0; filter: drop-shadow(0 0 10px color-mix(in srgb, var(--cr, #FFD700) 55%, transparent)); }
.ns-crate-info { flex: 1 1 200px; min-width: 0; }
.ns-crate-name { font-size: 14px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--cr, #FFD700); }
.ns-crate-blurb { font-family: 'EB Garamond', serif; font-size: 13px; color: #CFC4A6; margin: 2px 0 7px; }
.ns-odds { display: flex; flex-wrap: wrap; gap: 5px; }
.ns-odds span { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; padding: 2px 7px; border-radius: 10px;
  border: 1px solid currentColor; background: rgba(0,0,0,.25); }
.ns-crate-buy { display: flex; flex-direction: column; align-items: stretch; gap: 6px; min-width: 130px; }
.ns-crate-count { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #B8960C; text-align: center; }
.ns-crate-buy .ns-shop-price { justify-content: center; }
.ns-crate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; padding: 0 14px 14px; }
.ns-fc { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 8px 9px; text-align: center;
  background: rgba(255,215,0,.02); border: 1px solid rgba(184,150,12,.18); border-radius: 10px; }
.ns-fc.equipped { border-color: rgba(255,215,0,.7); box-shadow: 0 0 14px rgba(255,215,0,.12); }
.ns-fc.locked .ns-shop-prev { filter: grayscale(.5) brightness(.78); opacity: .9; }
.ns-fc.locked .ns-shop-name { opacity: .55; }
.ns-shop-prev { min-height: 76px; display: flex; align-items: center; justify-content: center; width: 100%; }
.ns-shop-av { width: 52px; height: 52px; border-radius: 50%; background: #1C1924; display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: #B8960C; flex-shrink: 0; }
.ns-shop-av img { width: 100%; height: 100%; object-fit: cover; }
.ns-shop-name { font-size: 10.5px; font-weight: 700; letter-spacing: 1px; color: #F0E6CA; }
.ns-shop-rarity { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; }
.ns-shop-price { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: #FFD700; }
.ns-shop-price .coin-svg { font-size: 15px; }
.ns-shop-btn { width: 100%; padding: 7px 0; font-family: 'Cinzel', serif; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
  border-radius: 8px; border: 1px solid rgba(184,150,12,.55); background: rgba(255,215,0,.08); color: #FFD700; cursor: pointer; }
.ns-shop-btn:hover:not(:disabled) { background: #FFD700; color: #07060A; }
.ns-shop-btn:disabled { opacity: .4; cursor: not-allowed; }
.ns-shop-btn.on { background: rgba(255,215,0,.18); }
.ns-shop-btn.big { padding: 10px 18px; width: auto; min-width: 120px; font-size: 10px; }
#ns-shop-foot { padding: 8px 16px; font-family: 'EB Garamond', serif; font-style: italic; font-size: 12px; color: #B8960C; opacity: .75; text-align: center; flex-shrink: 0; border-top: 1px solid rgba(255,215,0,.06); }
#shop-btn .coin-svg { font-size: 13px; }
#ns-coin-badge { cursor: pointer; }

/* ── crate opening ── */
#ns-open { position: absolute; inset: 0; z-index: 5; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 16px;
  background: radial-gradient(ellipse at 50% 38%, rgba(34,24,58,.97), rgba(4,3,8,.99)); }
#ns-open.on { display: flex; animation: nsShopIn .2s ease; }
#ns-open-title { font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: var(--cr, #FFD700); text-align: center; }
#ns-open-stage { width: min(700px, 94%); min-height: 190px; display: flex; align-items: center; justify-content: center; position: relative; }
.ns-shake { animation: nsShake .55s ease-in-out infinite; filter: drop-shadow(0 0 22px color-mix(in srgb, var(--cr, #FFD700) 70%, transparent)); }
@keyframes nsShake { 0%,100% { transform: rotate(0) scale(1); } 15% { transform: rotate(-8deg) scale(1.04); } 30% { transform: rotate(7deg) scale(1.08); } 45% { transform: rotate(-6deg) scale(1.06); } 60% { transform: rotate(5deg) scale(1.1); } 80% { transform: rotate(-2deg) scale(1.05); } }
.ns-reel { position: relative; width: 100%; overflow: hidden; border-radius: 14px; border: 1px solid rgba(255,215,0,.3); background: rgba(0,0,0,.5); padding: 16px 0;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
.ns-reel-track { display: flex; gap: 8px; will-change: transform; width: max-content; }
.ns-reel-cell { width: 104px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 4px 6px; border-radius: 10px;
  background: rgba(255,255,255,.03); border-bottom: 3px solid var(--rc, #888); box-sizing: border-box; min-height: 128px; justify-content: center; }
.ns-reel-cell .nm { font-size: 8px; letter-spacing: 1px; text-align: center; color: #CFC4A6; line-height: 1.25; }
.ns-reel-cell.win { background: color-mix(in srgb, var(--rc) 16%, transparent); box-shadow: 0 0 22px var(--rc); }
.ns-reel-mark { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #FFD700; box-shadow: 0 0 12px #FFD700; z-index: 2; pointer-events: none; }
.ns-reel-mark::before, .ns-reel-mark::after { content: ""; position: absolute; left: -6px; border: 7px solid transparent; }
.ns-reel-mark::before { top: 0; border-top-color: #FFD700; }
.ns-reel-mark::after  { bottom: 0; border-bottom-color: #FFD700; }
.ns-reveal { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; animation: nsPop .5s cubic-bezier(.2,1.4,.4,1); }
@keyframes nsPop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.ns-reveal-prev { padding: 26px 30px; border-radius: 18px; background: radial-gradient(circle, color-mix(in srgb, var(--rc) 28%, transparent), transparent 70%); }
.ns-reveal-name { font-size: 20px; font-weight: 700; letter-spacing: 3px; color: #F0E6CA; }
.ns-reveal-rar { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; }
.ns-reveal-note { font-family: 'EB Garamond', serif; font-size: 15px; color: #CFC4A6; min-height: 20px; display: inline-flex; align-items: center; gap: 6px; }
#ns-open-btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; min-height: 40px; }
`;
    return css;
  }

  // ───────────────────────────────────
  // STATE + FRAME RENDERING
  // ───────────────────────────────────
  const state = { owned: {}, avatarFrame: null, gameFrame: null, busy: false, tab: "avatar", open: false };
  let cosRef = null;
  let xpRef = null;
  let openCtx = null; // set while the crate-opening screen is up
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

  // The equipped game frame is a single attribute on <html>; CSS decorates every
  // .game-button (current and future ones) from it, so script.js needs no changes.
  function applyGameFrame() {
    const root = document.documentElement;
    if (state.gameFrame && findItem("game", state.gameFrame)) root.setAttribute("data-gfv", state.gameFrame);
    else root.removeAttribute("data-gfv");
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
      if (state.open && !openCtx) render();
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
      if (state.open && !openCtx) render(); // button states depend on the balance
    });
  }
  function detachBalance() { if (xpRef) { xpRef.off(); xpRef = null; } }

  // ───────────────────────────────────
  // UI
  // ───────────────────────────────────
  let overlay, gridEl, balEl, tabEls, footEl, openEl;

  function el(tag, props, kids) {
    const n = document.createElement(tag);
    if (props) Object.keys(props).forEach(k => {
      if (k === "text") n.textContent = props[k];
      else if (k === "class") n.className = props[k];
      else if (k === "html") n.innerHTML = props[k]; // trusted constants only (COIN_ICON, SVG, catalog colours)
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(c => c && n.appendChild(c));
    return n;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function crateSVG(accent, px) {
    return `<svg width="${px}" height="${px}" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" aria-hidden="true">`
      + `<path d="M8 26h48v28a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="#1C1510" stroke="${accent}" stroke-width="2.5"/>`
      + `<path d="M6 16a3 3 0 0 1 3-3h46a3 3 0 0 1 3 3v10H6z" fill="${accent}" fill-opacity=".28" stroke="${accent}" stroke-width="2.5"/>`
      + `<path d="M20 26v31M44 26v31" stroke="${accent}" stroke-opacity=".55" stroke-width="2.5"/>`
      + `<rect x="27" y="22" width="10" height="12" rx="2" fill="#FFD700" stroke="#7A5A00" stroke-width="1.6"/>`
      + `<circle cx="32" cy="28" r="1.8" fill="#3A2A00"/></svg>`;
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
    close.onclick = () => closeShop();
    modal.appendChild(el("div", { id: "ns-shop-head" }, [title, balEl, close]));

    const tabs = el("div", { id: "ns-shop-tabs" });
    tabEls = {};
    Object.keys(KINDS).forEach(kind => {
      const b = el("button", { class: "ns-shop-tab", text: KINDS[kind].tab });
      b.onclick = () => { if (openCtx) return; state.tab = kind; render(); };
      tabEls[kind] = b;
      tabs.appendChild(b);
    });
    modal.appendChild(tabs);

    gridEl = el("div", { id: "ns-shop-grid" });
    modal.appendChild(gridEl);
    footEl = el("div", { id: "ns-shop-foot", text: "Frames are cosmetic. Odds are shown on every crate; a duplicate refunds part of the price. Avatar frames show in chat, game frames on your game buttons." });
    modal.appendChild(footEl);

    openEl = el("div", { id: "ns-open" });
    modal.appendChild(openEl);

    overlay.appendChild(modal);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeShop(); });
    document.body.appendChild(overlay);
  }

  function renderBalance() {
    balEl.innerHTML = COIN_ICON + "<span></span>";
    balEl.lastChild.textContent = (window.__ns_userCoins || 0).toLocaleString();
  }

  // Thumbnail for game previews: first game with an image; gradient shows if it fails to load.
  function previewThumbUrl() {
    try {
      if (typeof games !== "undefined" && Array.isArray(games)) {
        const g = games.find(x => x && typeof x.image === "string" && /^(https?:|data:)/i.test(x.image));
        if (g) return g.image.replace(/["\\\n\r]/g, "");
      }
    } catch (e) { /* preview only */ }
    return "";
  }

  // px = preview size: avatar diameter, or game-button width.
  function previewNode(kind, item, px) {
    if (kind === "avatar") {
      const d = px || 52;
      const av = el("div", { class: "ns-shop-av" });
      av.style.width = av.style.height = d + "px";
      av.style.fontSize = Math.round(d * 0.38) + "px";
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
    g.setAttribute("data-gfv", item.id);
    g.style.setProperty("--pw", (px || 84) + "px");
    const art = el("div", { class: "ns-gf-art" });
    const url = previewThumbUrl();
    if (url) art.style.backgroundImage = `url("${url}"),linear-gradient(160deg,#2A2638,#141219)`;
    art.appendChild(el("div", { class: "ns-gf-lbl", text: "Your Game" }));
    g.appendChild(art);
    return g;
  }

  function oddsChips(crate) {
    const wrap = el("div", { class: "ns-odds" });
    core.crateOdds(crate).forEach(o => {
      const s = el("span", { text: RARITY[o.rarity].label + " " + (Math.round(o.pct * 10) / 10) + "%" });
      s.style.color = RARITY[o.rarity].color;
      wrap.appendChild(s);
    });
    return wrap;
  }

  function frameCard(kind, item) {
    const k = KINDS[kind];
    const owned = !!state.owned[item.id];
    const equipped = state[k.field] === item.id;
    const card = el("div", { class: "ns-fc" + (equipped ? " equipped" : "") + (owned ? "" : " locked") });
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
      btn.textContent = "Locked";
      btn.disabled = true;
    }
    if (state.busy) btn.disabled = true;
    card.appendChild(btn);
    return card;
  }

  function crateSection(crate) {
    const frames = framesOf(crate);
    const ownedN = frames.filter(f => state.owned[f.id]).length;
    const price = priceOf(crate);
    const sec = el("div", { class: "ns-crate" });
    sec.style.setProperty("--cr", crate.accent);

    const ico = el("div", { class: "ns-crate-ico", html: crateSVG(crate.accent, 64) });
    const info = el("div", { class: "ns-crate-info" }, [
      el("div", { class: "ns-crate-name", text: crate.name }),
      el("div", { class: "ns-crate-blurb", text: crate.blurb }),
      oddsChips(crate),
    ]);

    const buy = el("div", { class: "ns-crate-buy" });
    buy.appendChild(el("div", { class: "ns-crate-count", text: ownedN + " / " + frames.length + " collected" }));
    buy.appendChild(el("div", { class: "ns-shop-price", html: COIN_ICON + "<span>" + price.toLocaleString() + "</span>" }));
    const btn = el("button", { class: "ns-shop-btn" });
    const bal = window.__ns_userCoins || 0;
    if (ownedN >= frames.length) { btn.textContent = "Complete ✓"; btn.disabled = true; }
    else if (bal < price)        { btn.textContent = "Need " + (price - bal).toLocaleString() + " more"; btn.disabled = true; }
    else                         { btn.textContent = "Open Crate"; btn.onclick = () => doOpenCrate(crate); }
    if (state.busy) btn.disabled = true;
    buy.appendChild(btn);

    sec.appendChild(el("div", { class: "ns-crate-head" }, [ico, info, buy]));
    const grid = el("div", { class: "ns-crate-grid" });
    frames.forEach(f => grid.appendChild(frameCard(crate.kind, f)));
    sec.appendChild(grid);
    return sec;
  }

  function render() {
    if (!overlay) return;
    renderBalance();
    Object.keys(tabEls).forEach(k => tabEls[k].classList.toggle("active", k === state.tab));
    const top = gridEl.scrollTop;
    gridEl.textContent = "";
    cratesOf(state.tab).forEach(c => gridEl.appendChild(crateSection(c)));
    gridEl.scrollTop = top;
  }

  // ── crate opening screen ──
  function showOpen(crate) {
    openCtx = { crate, kind: crate.kind, skip: null, done: false, result: null };
    openEl.textContent = "";
    openEl.style.setProperty("--cr", crate.accent);
    const title = el("div", { id: "ns-open-title", text: "Opening " + crate.name });
    const stage = el("div", { id: "ns-open-stage" });
    const box = el("div", { class: "ns-shake", html: crateSVG(crate.accent, 132) });
    stage.appendChild(box);
    const btns = el("div", { id: "ns-open-btns" });
    openEl.appendChild(title); openEl.appendChild(stage); openEl.appendChild(btns);
    openCtx.stage = stage; openCtx.btns = btns; openCtx.title = title;
    openEl.classList.add("on");
  }
  function hideOpen() {
    openCtx = null;
    if (openEl) { openEl.classList.remove("on"); openEl.textContent = ""; }
  }

  function reelCell(kind, item) {
    const cell = el("div", { class: "ns-reel-cell" });
    cell.style.setProperty("--rc", RARITY[item.rarity].color);
    cell.appendChild(previewNode(kind, item, kind === "avatar" ? 54 : 70));
    cell.appendChild(el("div", { class: "nm", text: item.name }));
    return cell;
  }

  function playReel(crate, res) {
    return new Promise(resolve => {
      const ctx = openCtx;
      if (!ctx) { resolve(); return; }
      ctx.title.textContent = crate.name;
      ctx.stage.textContent = "";
      const vp = el("div", { class: "ns-reel" });
      const track = el("div", { class: "ns-reel-track" });
      const N = 44, W = 36;
      let winCell = null;
      for (let i = 0; i < N; i++) {
        const it = i === W ? res.item : core.rollItem(crate, Math.random); // fillers are cosmetic only
        const c = reelCell(crate.kind, it);
        if (i === W) winCell = c;
        track.appendChild(c);
      }
      vp.appendChild(track);
      vp.appendChild(el("div", { class: "ns-reel-mark" }));
      ctx.stage.appendChild(vp);

      const cellW = 104, gap = 8;
      const vpW = vp.clientWidth;
      const jitter = (Math.random() * 2 - 1) * cellW * 0.34; // stays inside the winning cell
      const target = W * (cellW + gap) + cellW / 2 - vpW / 2 + jitter;
      const dur = reduceMotion() ? 600 : 5600;

      let finished = false, timer = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        track.removeEventListener("transitionend", onEnd);
        ctx.skip = null;
        if (winCell) winCell.classList.add("win");
        resolve();
      };
      const onEnd = (e) => { if (e.target === track && e.propertyName === "transform") finish(); };
      track.addEventListener("transitionend", onEnd);
      timer = setTimeout(finish, dur + 500);
      ctx.skip = () => {
        track.style.transition = "none";
        track.style.transform = `translateX(${-target}px)`;
        finish();
      };

      track.style.transform = "translateX(0)";
      track.getBoundingClientRect(); // commit the start position before animating
      track.style.transition = `transform ${dur}ms cubic-bezier(.12,.6,.1,1)`;
      track.style.transform = `translateX(${-target}px)`;

      const skipBtn = el("button", { class: "ns-shop-btn big", text: "Skip" });
      skipBtn.onclick = () => { if (ctx.skip) ctx.skip(); };
      ctx.btns.textContent = "";
      ctx.btns.appendChild(skipBtn);
    });
  }

  function revealResult(crate, res) {
    const ctx = openCtx;
    if (!ctx) return;
    ctx.done = true;
    const item = res.item, kind = crate.kind, r = RARITY[item.rarity];
    ctx.stage.textContent = "";
    ctx.title.textContent = res.duplicate ? "Duplicate" : "New frame unlocked";

    const box = el("div", { class: "ns-reveal" });
    box.style.setProperty("--rc", r.color);
    const prev = el("div", { class: "ns-reveal-prev" }, [previewNode(kind, item, kind === "avatar" ? 96 : 132)]);
    const name = el("div", { class: "ns-reveal-name", text: item.name });
    const rar = el("div", { class: "ns-reveal-rar", text: r.label });
    rar.style.color = r.color;
    const note = el("div", { class: "ns-reveal-note" });
    if (!res.duplicate) note.textContent = "Added to your collection.";
    else if (res.refundFailed) note.textContent = "You already own this, and the refund failed. Please contact a mod.";
    else if (res.refund > 0) note.innerHTML = "You already own this. Refunded " + res.refund.toLocaleString() + " " + COIN_ICON;
    else note.textContent = "You already own this.";
    [prev, name, rar, note].forEach(n => box.appendChild(n));
    ctx.stage.appendChild(box);

    const k = KINDS[kind];
    ctx.btns.textContent = "";
    const equipBtn = el("button", { class: "ns-shop-btn big" });
    const refreshEquip = () => {
      const on = state[k.field] === item.id;
      equipBtn.textContent = on ? "Equipped ✓" : "Equip";
      equipBtn.classList.toggle("on", on);
    };
    refreshEquip();
    equipBtn.onclick = async () => {
      equipBtn.disabled = true;
      await doEquip(kind, state[k.field] === item.id ? null : item.id, false, true);
      equipBtn.disabled = false;
      refreshEquip();
    };
    ctx.btns.appendChild(equipBtn);

    const again = el("button", { class: "ns-shop-btn big" });
    const price = priceOf(crate), bal = window.__ns_userCoins || 0;
    const complete = framesOf(crate).every(f => state.owned[f.id]);
    if (complete) { again.textContent = "Crate complete ✓"; again.disabled = true; }
    else if (bal < price) { again.textContent = "Need " + (price - bal).toLocaleString() + " more"; again.disabled = true; }
    else { again.textContent = "Open Another"; again.onclick = () => { hideOpen(); doOpenCrate(crate); }; }
    ctx.btns.appendChild(again);

    const done = el("button", { class: "ns-shop-btn big", text: "Done" });
    done.onclick = () => { hideOpen(); render(); };
    ctx.btns.appendChild(done);
  }

  async function doOpenCrate(crate) {
    if (state.busy || openCtx) return;
    const user = me();
    state.busy = true;
    render();
    showOpen(crate);
    const [res] = await Promise.all([core.open(db, user, crate.id), sleep(reduceMotion() ? 200 : 1100)]);
    if (!openCtx || me() !== user) { state.busy = false; hideOpen(); return; } // logged out mid-open; the result is already saved
    if (!res.ok) {
      state.busy = false;
      hideOpen();
      const msg = {
        insufficient: "Not enough coins",
        login: "Log in to shop",
        unknown: "Unknown crate",
        error: res.refundFailed ? "Something failed — check your balance and contact a mod" : "Something failed — you were not charged",
      }[res.reason] || "Could not open crate";
      showCoinToast("⚠ " + msg);
      if (res.error) console.warn("[shop] open failed:", res.error);
      render();
      return;
    }
    window.__ns_userCoins = res.balance;
    if (typeof updateCoinBadge === "function") updateCoinBadge(res.balance);
    state.owned[res.item.id] = state.owned[res.item.id] || Date.now();
    await playReel(crate, res);
    state.busy = false;
    revealResult(crate, res);
  }

  async function doEquip(kind, id, quiet, keepOpen) {
    if (state.busy && !quiet) return;
    const res = await core.equip(db, me(), kind, id);
    if (!res.ok && !quiet) showCoinToast("⚠ Could not equip");
    if (res.error) console.warn("[shop] equip failed:", res.error);
    if (res.ok) {
      state[KINDS[kind].field] = id; // the listener confirms this a moment later
      if (kind === "game") applyGameFrame(); else refreshOwnAvatars();
    }
    if (!keepOpen) render();
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
  function closeShop(force) {
    if (openCtx && !force) { if (openCtx.skip) openCtx.skip(); else if (openCtx.done) { hideOpen(); render(); } return; }
    hideOpen();
    state.open = false;
    state.busy = false;
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
    const problems = core.validateCatalog();
    if (problems.length) console.error("[shop] catalog problems:\n - " + problems.join("\n - "));

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
    // Escape: skips a running roll, dismisses a result, else closes the shop —
    // handled before script.js's handler can close the game viewer.
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && state.open) { e.stopPropagation(); closeShop(); }
    }, true);

    window.addEventListener("ns_login", e => {
      const u = (e.detail && e.detail.username) || me();
      setShopButtonVisible(true);
      attachSelf(u);
    });
    window.addEventListener("ns_logout", () => {
      closeShop(true);
      detachSelf();
      resetState();
      setShopButtonVisible(false);
    });
    if (me()) attachSelf(me());
  }

  window.NSShop = { decorateAvatar, open: openShop, close: closeShop, core, CRATES, AVATAR_FRAMES, GAME_FRAMES };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
