import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(from, to);
}

let css = fs.readFileSync('src/index.css', 'utf8');
css = replaceOnce(css,
`  .titan-surface-interactive:active {\n    transform: translateY(0) scale(0.995);\n  }\n`,
`  .titan-surface-interactive:active {\n    transform: translateY(0) scale(0.995);\n  }\n\n  /* Titan spatial layout language — bento density + editorial hierarchy + restrained depth */\n  .titan-bento-grid {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr);\n    gap: clamp(0.75rem, 1.6vw, 1rem);\n    grid-auto-flow: dense;\n    align-items: start;\n  }\n  @media (min-width: 1024px) {\n    .titan-bento-grid {\n      grid-template-columns: repeat(12, minmax(0, 1fr));\n    }\n    .titan-bento-item { grid-column: span 6 / span 6; }\n    .titan-bento-item-wide { grid-column: span 12 / span 12; }\n  }\n\n  .titan-bento-card {\n    position: relative;\n    isolation: isolate;\n    overflow: hidden;\n    background:\n      linear-gradient(145deg, hsl(var(--card) / 0.98), hsl(var(--card) / 0.92));\n  }\n  .titan-bento-card::before {\n    content: \"\";\n    position: absolute;\n    inset: 0;\n    z-index: -1;\n    pointer-events: none;\n    background: radial-gradient(80% 55% at 10% 0%, hsl(var(--primary) / 0.08), transparent 62%);\n    opacity: 0;\n    transition: opacity var(--duration-base) var(--ease-out);\n  }\n  .titan-bento-card:hover::before { opacity: 1; }\n\n  .titan-editorial-header {\n    position: relative;\n    padding-block: clamp(0.25rem, 1vw, 0.75rem) clamp(0.75rem, 2vw, 1.25rem);\n  }\n  .titan-editorial-header h1 {\n    max-width: 15ch;\n    font-size: clamp(2rem, 3.8vw, 3.75rem);\n    line-height: 0.98;\n    letter-spacing: -0.055em;\n  }\n  .titan-editorial-header p:not(.text-caption) { max-width: 56ch; }\n\n  .titan-rolling-surface {\n    transform: translateZ(0);\n    will-change: transform, box-shadow;\n    transition:\n      transform 260ms cubic-bezier(0.16, 1, 0.3, 1),\n      box-shadow 260ms cubic-bezier(0.16, 1, 0.3, 1),\n      border-color 220ms var(--ease-out);\n  }\n  .titan-rolling-surface:hover {\n    transform: translate3d(0, -2px, 0);\n    box-shadow: var(--shadow-lift);\n    border-color: hsl(var(--primary) / 0.24);\n  }\n  .titan-rolling-surface:active { transform: translate3d(0, 0, 0) scale(0.998); }\n\n  .titan-depth-card {\n    position: relative;\n    overflow: hidden;\n    transform: translateZ(0);\n    background:\n      radial-gradient(120% 100% at 100% 0%, hsl(var(--primary) / 0.14), transparent 52%),\n      linear-gradient(135deg, hsl(var(--card)), hsl(var(--card) / 0.94));\n    box-shadow:\n      0 1px 0 hsl(var(--foreground) / 0.04) inset,\n      0 22px 60px -32px hsl(var(--primary) / 0.42),\n      var(--shadow-soft);\n  }\n  .titan-depth-card::after {\n    content: \"\";\n    position: absolute;\n    width: 14rem;\n    height: 14rem;\n    border-radius: 999px;\n    right: -6rem;\n    top: -7rem;\n    pointer-events: none;\n    background: radial-gradient(circle, hsl(var(--primary) / 0.14), transparent 68%);\n    filter: blur(3px);\n  }\n\n  .titan-overview-grid {\n    display: grid;\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n    gap: 0.75rem;\n  }\n  .titan-overview-cell {\n    min-width: 0;\n    border: 1px solid hsl(var(--border) / 0.85);\n    border-radius: var(--radius-lg);\n    background: hsl(var(--background) / 0.52);\n    padding: clamp(0.85rem, 2vw, 1.15rem);\n    backdrop-filter: blur(10px);\n    -webkit-backdrop-filter: blur(10px);\n  }\n  .titan-overview-cell-primary { grid-column: span 2 / span 2; }\n  @media (min-width: 640px) {\n    .titan-overview-grid { grid-template-columns: 1.15fr 0.85fr 1fr; }\n    .titan-overview-cell-primary { grid-column: auto; }\n  }\n\n  .titan-action-rail {\n    display: grid;\n    grid-auto-flow: column;\n    grid-auto-columns: minmax(11.5rem, 0.72fr);\n    gap: 0.5rem;\n    overflow-x: auto;\n    overscroll-behavior-inline: contain;\n    scroll-snap-type: inline proximity;\n    scrollbar-width: thin;\n  }\n  .titan-action-chip {\n    scroll-snap-align: start;\n    border: 1px solid hsl(var(--border));\n    border-radius: var(--radius-lg);\n    background: hsl(var(--background) / 0.66);\n    padding: 0.7rem 0.8rem;\n    transition: transform var(--duration-base) var(--ease-out), border-color var(--duration-base) var(--ease-out);\n  }\n  .titan-action-chip:hover {\n    transform: translateY(-1px);\n    border-color: hsl(var(--primary) / 0.28);\n  }\n`,
'layout primitives');
css = replaceOnce(css,
`  .page-enter,\n  .ai-pulse,`,
`  .page-enter,\n  .titan-rolling-surface:hover,\n  .titan-rolling-surface:active,\n  .titan-action-chip:hover,\n  .ai-pulse,`,
'reduced motion system');
css = replaceOnce(css,
`html.reduce-motion .page-enter,\nhtml.reduce-motion .ai-pulse,`,
`html.reduce-motion .page-enter,\nhtml.reduce-motion .titan-rolling-surface:hover,\nhtml.reduce-motion .titan-rolling-surface:active,\nhtml.reduce-motion .titan-action-chip:hover,\nhtml.reduce-motion .ai-pulse,`,
'reduced motion class');
fs.writeFileSync('src/index.css', css);

let dashboard = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');
dashboard = replaceOnce(dashboard,
`      className={\`overflow-hidden transition-[box-shadow,opacity,transform] duration-base ${\n        bare ? \"\" : \"titan-surface\"\n      } ${`,
`      className={\`overflow-hidden transition-[box-shadow,opacity,transform] duration-base ${\n        bare ? \"\" : \"titan-surface titan-bento-card titan-rolling-surface\"\n      } ${`,
'widget shell');
dashboard = replaceOnce(dashboard,
`      <header className=\"mb-5 flex flex-wrap items-start justify-between gap-3\">`,
`      <header className=\"titan-editorial-header mb-5 flex flex-wrap items-start justify-between gap-3\">`,
'editorial header');
dashboard = replaceOnce(dashboard,
`      <div className=\"mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2\">`,
`      <div className=\"titan-bento-grid mt-4\">`,
'bento grid');
dashboard = replaceOnce(dashboard,
`            className={\`${WIDE_WIDGETS.has(id) ? \"lg:col-span-2\" : \"\"} ${\n              customize && hiddenWidgets.includes(id) ? \"opacity-45\" : \"\"\n            }\`}`,
`            className={\`titan-bento-item ${WIDE_WIDGETS.has(id) ? \"titan-bento-item-wide\" : \"\"} ${\n              customize && hiddenWidgets.includes(id) ? \"opacity-45\" : \"\"\n            }\`}`,
'bento item');
fs.writeFileSync('src/pages/Dashboard.jsx', dashboard);

let overview = fs.readFileSync('src/components/dashboard/OverviewTodayCard.jsx', 'utf8');
overview = replaceOnce(overview,
`      className=\"titan-surface mb-5 overflow-hidden p-4 sm:p-5\"`,
`      className=\"titan-surface titan-depth-card mb-5 overflow-hidden p-4 sm:p-5 md:p-6\"`,
'overview depth');
overview = replaceOnce(overview,
`      <div className=\"grid grid-cols-2 gap-4 sm:grid-cols-3 sm:items-center\">\n        <div>`,
`      <div className=\"titan-overview-grid\">\n        <div className=\"titan-overview-cell titan-overview-cell-primary\">`,
'overview grid');
overview = replaceOnce(overview,
`        <div className=\"flex flex-col items-center justify-center\">`,
`        <div className=\"titan-overview-cell flex flex-col items-center justify-center\">`,
'overview gauge');
overview = replaceOnce(overview,
`        <div className=\"col-span-2 sm:col-span-1\">`,
`        <div className=\"titan-overview-cell\">`,
'overview ontime');
fs.writeFileSync('src/components/dashboard/OverviewTodayCard.jsx', overview);

let ai = fs.readFileSync('src/pages/AIAssistant.jsx', 'utf8');
ai = replaceOnce(ai,
`<div className=\"max-w-4xl mx-auto rounded-xl border border-border bg-card/50 px-3 py-2\"><div className=\"text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5\">Recent 2nd Me actions</div><div className=\"flex gap-2 overflow-x-auto pb-1\">{actionHistory.map((item) => <div key={item.correlationId} className=\"min-w-[180px] rounded-lg bg-background/70 border border-border px-2.5 py-2\">`,
`<div className=\"titan-surface titan-bento-card max-w-4xl mx-auto px-3 py-2\"><div className=\"text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5\">Recent 2nd Me actions</div><div className=\"titan-action-rail pb-1\">{actionHistory.map((item) => <div key={item.correlationId} className=\"titan-action-chip\">`,
'action rail');
fs.writeFileSync('src/pages/AIAssistant.jsx', ai);
