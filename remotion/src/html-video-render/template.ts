import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type {
  HtmlVideoOutputTarget,
  HtmlVideoScene,
  HtmlVideoStoryboard,
} from "../handoff/storyboard.js";

export interface HtmlVideoTemplateOptions {
  projectDir: string;
  duration?: number;
}

interface BrowserScene {
  id: string;
  start: number;
  end: number;
  duration: number;
  text: string;
  rows: string[];
  letter: string | null;
  letterAssetUrl: string | null;
  words: Array<{ text: string; start: number; end: number }>;
  audio: HtmlVideoScene["audio"];
}

interface BrowserStoryboard {
  duration: number;
  project: HtmlVideoStoryboard["project"];
  target: HtmlVideoOutputTarget;
  assets: {
    backgroundUrl: string;
    songLogoUrl: string;
    channelLogoUrl: string;
  };
  scenes: BrowserScene[];
}

export function buildHtmlVideoDocument(
  storyboard: HtmlVideoStoryboard,
  target: HtmlVideoOutputTarget,
  options: HtmlVideoTemplateOptions,
): string {
  const duration = Math.max(0.5, options.duration ?? storyboard.duration);
  const browserData: BrowserStoryboard = {
    duration,
    project: storyboard.project,
    target,
    assets: {
      backgroundUrl: projectAssetUrl(options.projectDir, storyboard.assets.background),
      songLogoUrl: projectAssetUrl(options.projectDir, storyboard.assets.songLogo),
      channelLogoUrl: projectAssetUrl(options.projectDir, storyboard.assets.channelLogo),
    },
    scenes: storyboard.scenes
      .filter((scene) => scene.start < duration)
      .map((scene) => ({
        id: scene.id,
        start: scene.start,
        end: Math.min(scene.end, duration),
        duration: Math.min(scene.end, duration) - scene.start,
        text: scene.text,
        rows: scene.rows,
        letter: scene.letter,
        letterAssetUrl: scene.letterAsset
          ? projectAssetUrl(options.projectDir, scene.letterAsset)
          : null,
        words: scene.words.map((word) => ({
          ...word,
          end: Math.min(word.end, duration),
        })),
        audio: scene.audio,
      })),
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(storyboard.project.songName)} - html-video</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif;
      background: #08090b;
      --yellow: #ffd95c;
      --cyan: #48d7ff;
      --ink: #101318;
      --panel: rgba(8, 10, 14, 0.56);
      --panel-strong: rgba(8, 10, 14, 0.7);
      --white: #fff8e7;
    }
    * { box-sizing: border-box; }
    html, body, #stage {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
    }
    body {
      background: #08090b;
      color: var(--white);
    }
    #stage {
      position: relative;
      isolation: isolate;
    }
    #background {
      position: absolute;
      inset: -2%;
      width: 104%;
      height: 104%;
      object-fit: cover;
      transform-origin: center;
      filter: brightness(0.86) saturate(1.12) contrast(1.04) blur(2px);
      transition: transform 120ms linear, filter 120ms linear;
      z-index: 0;
    }
    #shade {
      position: absolute;
      inset: 0;
      z-index: 1;
      background:
        radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.12), transparent 34%),
        linear-gradient(180deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.54));
    }
    #info {
      position: absolute;
      left: 32px;
      top: 28px;
      z-index: 4;
      display: grid;
      grid-template-columns: 86px minmax(0, 1fr);
      gap: 18px;
      align-items: center;
      width: min(760px, calc(100% - 210px));
      padding: 16px 22px 16px 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      background: var(--panel);
      backdrop-filter: blur(14px);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    }
    #song-logo {
      width: 86px;
      height: 86px;
      object-fit: contain;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.12);
    }
    #song-title {
      margin: 0;
      font-size: clamp(28px, 3vw, 54px);
      line-height: 1.02;
      letter-spacing: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #singer {
      margin-top: 6px;
      font-size: clamp(18px, 1.4vw, 26px);
      color: rgba(255, 248, 231, 0.78);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #channel-logo {
      position: absolute;
      right: 32px;
      top: 28px;
      z-index: 4;
      width: 116px;
      height: 116px;
      object-fit: cover;
      border-radius: 50%;
      border: 5px solid rgba(255, 255, 255, 0.88);
      background: white;
      box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35);
    }
    #letter-wrap {
      position: absolute;
      inset: 0;
      z-index: 3;
      display: grid;
      place-items: center;
      padding: 155px 130px 210px;
      pointer-events: none;
    }
    #letter-card {
      position: relative;
      display: grid;
      place-items: center;
      width: min(58vw, 980px);
      max-height: 58vh;
      transform-origin: center;
      transition: transform 60ms linear, filter 80ms linear, opacity 160ms linear;
    }
    #letter-img {
      display: block;
      max-width: 100%;
      max-height: 58vh;
      object-fit: contain;
      image-rendering: auto;
      filter: drop-shadow(0 28px 30px rgba(0, 0, 0, 0.34));
    }
    #bars-left,
    #bars-right {
      position: absolute;
      z-index: 2;
      top: 24%;
      bottom: 20%;
      width: 82px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 7px;
      opacity: 0.86;
    }
    #bars-left { left: 38px; }
    #bars-right { right: 38px; }
    .bar {
      width: 9px;
      min-height: 18px;
      border-radius: 999px;
      background: linear-gradient(180deg, #fff5a7, #ff7f50 52%, #48d7ff);
      box-shadow: 0 0 18px rgba(72, 215, 255, 0.34);
      transform-origin: bottom;
      transition: height 70ms linear;
    }
    #lyrics {
      position: absolute;
      left: 50%;
      bottom: 50px;
      z-index: 5;
      width: min(1500px, calc(100% - 110px));
      transform: translateX(-50%);
      padding: 24px 36px 28px;
      border-radius: 26px;
      background: var(--panel-strong);
      border: 1px solid rgba(255, 255, 255, 0.22);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
      text-align: center;
      backdrop-filter: blur(16px);
    }
    #lyric-text {
      margin: 0;
      font-size: clamp(34px, 4vw, 76px);
      line-height: 1.15;
      font-weight: 850;
      letter-spacing: 0;
      text-wrap: balance;
    }
    .word {
      display: inline-block;
      margin: 0 0.12em;
      color: rgba(255, 248, 231, 0.82);
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.36);
      transform-origin: center bottom;
      transition: color 80ms linear, transform 80ms linear, text-shadow 80ms linear;
    }
    .word.lit {
      color: var(--yellow);
      transform: translateY(-2px) scale(1.045);
      text-shadow: 0 0 14px rgba(255, 217, 92, 0.58);
    }
    @media (max-aspect-ratio: 3 / 4) {
      #info {
        left: 24px;
        top: 24px;
        width: calc(100% - 178px);
        grid-template-columns: 72px minmax(0, 1fr);
        border-radius: 22px;
      }
      #song-logo { width: 72px; height: 72px; }
      #channel-logo { right: 24px; top: 24px; width: 102px; height: 102px; }
      #letter-wrap { padding: 170px 54px 350px; }
      #letter-card { width: min(86vw, 980px); max-height: 48vh; }
      #letter-img { max-height: 48vh; }
      #lyrics {
        bottom: 150px;
        width: calc(100% - 70px);
        padding: 28px 24px 34px;
      }
      #bars-left, #bars-right { width: 58px; top: 30%; bottom: 28%; }
      #bars-left { left: 16px; }
      #bars-right { right: 16px; }
      .bar { width: 7px; }
    }
  </style>
</head>
<body>
  <main id="stage">
    <img id="background" alt="" />
    <div id="shade"></div>
    <section id="info">
      <img id="song-logo" alt="" />
      <div>
        <h1 id="song-title"></h1>
        <div id="singer"></div>
      </div>
    </section>
    <img id="channel-logo" alt="" />
    <div id="bars-left"></div>
    <div id="bars-right"></div>
    <section id="letter-wrap">
      <div id="letter-card"><img id="letter-img" alt="" /></div>
    </section>
    <section id="lyrics"><p id="lyric-text"></p></section>
  </main>
  <script>
    const STORYBOARD = ${safeJson(browserData)};
    const els = {
      background: document.getElementById("background"),
      songLogo: document.getElementById("song-logo"),
      channelLogo: document.getElementById("channel-logo"),
      songTitle: document.getElementById("song-title"),
      singer: document.getElementById("singer"),
      letterCard: document.getElementById("letter-card"),
      letterImg: document.getElementById("letter-img"),
      lyricText: document.getElementById("lyric-text"),
      barsLeft: document.getElementById("bars-left"),
      barsRight: document.getElementById("bars-right"),
    };
    els.background.src = STORYBOARD.assets.backgroundUrl;
    els.songLogo.src = STORYBOARD.assets.songLogoUrl;
    els.channelLogo.src = STORYBOARD.assets.channelLogoUrl;
    els.songTitle.textContent = STORYBOARD.project.songName;
    els.singer.textContent = STORYBOARD.project.singerName;
    for (const holder of [els.barsLeft, els.barsRight]) {
      for (let i = 0; i < 12; i++) {
        const bar = document.createElement("span");
        bar.className = "bar";
        holder.appendChild(bar);
      }
    }
    let activeId = "";
    let startMs = performance.now();
    const imageUrls = [
      STORYBOARD.assets.backgroundUrl,
      STORYBOARD.assets.songLogoUrl,
      STORYBOARD.assets.channelLogoUrl,
      ...STORYBOARD.scenes.map((scene) => scene.letterAssetUrl).filter(Boolean),
    ];
    window.__MV_READY__ = Promise.all(imageUrls.map((url) => new Promise((resolve) => {
      const image = new Image();
      image.onload = resolve;
      image.onerror = resolve;
      image.src = url;
    }))).then(() => {
      renderAt(0);
      return true;
    });
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    function escapeText(value) {
      return String(value).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch]);
    }
    function activeScene(t) {
      return STORYBOARD.scenes.find((scene) => t >= scene.start && t <= scene.end)
        ?? STORYBOARD.scenes.findLast?.((scene) => scene.start <= t)
        ?? STORYBOARD.scenes[0];
    }
    function renderLyric(scene, t) {
      if (!scene) return;
      if (scene.words.length > 0) {
        els.lyricText.innerHTML = scene.words.map((word) => {
          const lit = t >= word.start ? " lit" : "";
          return '<span class="word' + lit + '">' + escapeText(word.text) + '</span>';
        }).join(" ");
        return;
      }
      els.lyricText.innerHTML = scene.rows.map((row) =>
        '<span class="word lit">' + escapeText(row) + '</span>'
      ).join("<br />");
    }
    function renderBars(scene, t) {
      const rms = scene?.audio?.averageRms ?? 0.2;
      const bass = scene?.audio?.averageBass ?? 0.2;
      const bars = [...els.barsLeft.children, ...els.barsRight.children];
      bars.forEach((bar, i) => {
        const phase = Math.sin(t * 5.2 + i * 0.7) * 0.5 + 0.5;
        const height = 24 + 220 * clamp(0.35 * rms + 0.45 * bass + 0.2 * phase, 0, 1);
        bar.style.height = height.toFixed(1) + "px";
      });
    }
    function renderAt(rawTime) {
      const t = Math.min(STORYBOARD.duration, Math.max(0, rawTime));
      const scene = activeScene(t);
      if (scene && scene.id !== activeId) {
        activeId = scene.id;
        els.letterImg.src = scene.letterAssetUrl || "";
        els.letterCard.style.opacity = scene.letterAssetUrl ? "1" : "0";
      }
      const rms = scene?.audio?.averageRms ?? 0.2;
      const bass = scene?.audio?.averageBass ?? 0.2;
      const beat = Math.max(0, Math.sin(t * Math.PI * 2 * 1.8));
      const scale = 1 + 0.08 * clamp(rms, 0, 1);
      const letterScale = 1 + 0.22 * clamp(bass, 0, 1) + 0.12 * beat;
      els.background.style.transform = "scale(" + scale.toFixed(4) + ")";
      els.background.style.filter =
        "brightness(" + (0.82 + 0.18 * clamp(rms, 0, 1)).toFixed(3) + ") saturate(1.12) contrast(1.04) blur(2px)";
      els.letterCard.style.transform = "scale(" + letterScale.toFixed(4) + ")";
      els.letterCard.style.filter =
        "drop-shadow(0 0 " + (18 + beat * 24).toFixed(0) + "px rgba(255, 217, 92, 0.45))";
      renderLyric(scene, t);
      renderBars(scene, t);
    }
    window.__MV_RENDER_AT__ = renderAt;
    function tick() {
      const t = (performance.now() - startMs) / 1000;
      renderAt(t);
      if (t < STORYBOARD.duration) requestAnimationFrame(tick);
    }
    if (!new URLSearchParams(window.location.search).has("frame-render")) {
      requestAnimationFrame(tick);
    }
  </script>
</body>
</html>
`;
}

export function projectAssetUrl(projectDir: string, relativePath: string): string {
  return pathToFileURL(join(projectDir, relativePath)).href;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escaped[char] ?? char;
  });
}
