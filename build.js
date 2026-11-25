#!/usr/bin/env node
/* ============================================================
   build.js —— 把 posts/*.md 和 about.md 变成整个网站
   用法：node build.js    输出到 dist/
   零依赖，只用 Node 自带模块。
   ============================================================ */

const fs = require('fs');
const path = require('path');

/* ---------------- 站点配置（改这里就行） ---------------- */

const SITE = {
  name: 'Micca',
  tagline: 'Notes & Essays',
  intro: '在这里放一些想清楚了的东西。',
  introSub: '关于招聘、组织与人的笔记，也有一些工作以外的记录。内容按板块归档，不做时间流；有新东西时，最下面那一栏会告诉你。',
  email: 'hi@micca.cn',
  siteUrl: '',            // 绑域名后填 https://micca.cn，现在留空
  boards: [
    { id: 'recruiting', name: '招聘方法论', desc: '面试、胜任力、人才地图——做过的事和想明白的道理' },
    { id: 'org',        name: '组织与人才', desc: '组织怎么长、激励怎么设、文化怎么不是墙上标语' },
    { id: 'reading',    name: '读书与输入', desc: '读过的书，和读完留下的那几句话' },
    { id: 'life',       name: '日常',       desc: '工作以外，一些没什么用但想记下来的' },
  ],
};

const SRC = __dirname;
const OUT = path.join(SRC, 'dist');

/* ---------------- 工具 ---------------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => `<a href="${h}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s;
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const isBlockStart = (l) =>
    /^\s*$/.test(l) || /^#{1,4}\s/.test(l) || /^```/.test(l) || /^>/.test(l) ||
    /^[-*+]\s/.test(l) || /^\d+\.\s/.test(l) || /^(-{3,}|\*{3,}|_{3,})\s*$/.test(l) ||
    /^\s*\|/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) { i++; continue; }

    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(h[1].length + 1, 4);
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++; continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(`<table><thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${
        rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
      }</tbody></table>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${mdToHtml(buf.join('\n'))}</blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^[-*+]\s+/, '')); i++; }
      out.push(`<ul>${buf.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\d+\.\s+/, '')); i++; }
      out.push(`<ol>${buf.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    const buf = [];
    while (i < lines.length && !isBlockStart(lines[i])) { buf.push(lines[i].trim()); i++; }
    const joined = /[\u4e00-\u9fa5]/.test(buf.join('')) ? buf.join('') : buf.join(' ');
    out.push(`<p>${inline(joined)}</p>`);
  }

  return out.join('\n');
}

function parseFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  m[1].split('\n').forEach((l) => {
    const i = l.indexOf(':');
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  });
  return { meta, body: m[2] };
}

function loadPosts() {
  const dir = path.join(SRC, 'posts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const { meta, body } = parseFrontMatter(raw);
      const base = f.replace(/\.md$/, '');
      const dm = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
      const date = meta.date || (dm ? dm[1] : '2026-01-01');
      const slug = dm ? dm[2] : base;
      return {
        title: meta.title || slug,
        board: meta.board || SITE.boards[0].id,
        summary: meta.summary || '',
        date,
        slug,
        html: mdToHtml(body),
        words: body.replace(/\s/g, '').length,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function relTime(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+08:00');
  const now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return '今天更新';
  if (days === 1) return '昨天更新';
  if (days < 7) return `${days} 天前更新`;
  if (days < 30) return `${Math.floor(days / 7)} 周前更新`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前更新`;
  return `${Math.floor(days / 365)} 年前更新`;
}

const fmtDate = (s) => s.replace(/-/g, '.');

/* ---------------- 页面骨架 ---------------- */

function head({ title, desc }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
<link rel="stylesheet" href="styles.css">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="feed.xml">
</head>
<body>

<header class="site-head">
  <div class="wrap">
    <a class="brand" href="index.html">
      <b>${esc(SITE.name)}</b>
      <small>${esc(SITE.tagline)}</small>
    </a>
    <nav class="site-nav">
      <a href="index.html"${active === 'home' ? ' class="is-here"' : ''}>首页</a>
      <a href="about.html"${active === 'about' ? ' class="is-here"' : ''}>关于</a>
      <a href="feed.xml">订阅</a>
    </nav>
  </div>
</header>
`;
}

let active = 'home';

function foot() {
  return `
<footer class="site-foot">
  <div class="wrap">
    <div>© ${new Date().getFullYear()} ${esc(SITE.name)} · 文字保留所有权利</div>
    <div class="foot-links">
      <a href="feed.xml">RSS</a>
      <a href="mailto:${SITE.email}">Email</a>
    </div>
  </div>
</footer>

</body>
</html>
`;
}

/* ---------------- 首页 ---------------- */

function renderIndex(posts) {
  active = 'home';
  const boards = SITE.boards.map((b, idx) => {
    const list = posts.filter((p) => p.board === b.id);
    const latest = list[0];
    return `
      <a class="board" href="board-${b.id}.html">
        <span class="board-idx">${String(idx + 1).padStart(2, '0')}</span>
        <span class="board-name">${esc(b.name)}</span>
        <span class="board-desc">${esc(b.desc)}</span>
        <span class="board-meta"><b>${list.length}</b> 篇<br>${latest ? relTime(latest.date) : '还没有内容'}</span>
      </a>`;
  }).join('');

  const recent = posts.slice(0, 8).map((p) => {
    const b = SITE.boards.find((x) => x.id === p.board);
    return `
      <li>
        <span class="date">${fmtDate(p.date)}</span>
        <span class="tag">${esc(b ? b.name : '未分类')}</span>
        <a class="title" href="post-${p.slug}.html">${esc(p.title)}</a>
      </li>`;
  }).join('');

  return `${head({ title: SITE.name, desc: SITE.intro })}
<main>
  <section class="hero wrap">
    <h1>${esc(SITE.intro)}</h1>
    <p>${esc(SITE.introSub)}</p>
  </section>

  <section class="wrap">
    <div class="boards">${boards}
    </div>
  </section>

  <section class="updates wrap">
    <span class="label">最近更新 · Latest</span>
    <ol>${recent}
    </ol>
  </section>
</main>
${foot()}`;
}

/* ---------------- 板块页 ---------------- */

function renderBoard(b, posts) {
  active = 'home';
  const list = posts.filter((p) => p.board === b.id);
  const items = list.map((p, i) => `
      <a class="feed-item" href="post-${p.slug}.html">
        <span class="date">${fmtDate(p.date)}</span>
        <h2>${esc(p.title)}${i === 0 ? '<span class="mark">NEW</span>' : ''}</h2>
        <p>${esc(p.summary)}</p>
      </a>`).join('');

  const body = list.length
    ? items
    : `<p style="padding:40px 0;color:var(--ink-3)">这个板块还空着。</p>`;

  return `${head({ title: `${b.name} · ${SITE.name}`, desc: b.desc })}
<main>
  <section class="page-head wrap">
    <span class="label">共 ${list.length} 篇</span>
    <h1>${esc(b.name)}</h1>
    <p>${esc(b.desc)}</p>
  </section>

  <section class="wrap">
    <div class="feed">${body}
    </div>
  </section>
</main>
${foot()}`;
}

/* ---------------- 文章页 ---------------- */

function renderPost(p, posts) {
  active = 'home';
  const b = SITE.boards.find((x) => x.id === p.board);
  const idx = posts.indexOf(p);
  const newer = posts[idx - 1];
  const older = posts[idx + 1];

  const min = Math.max(1, Math.round(p.words / 400));
  const pager = `
    <nav class="pager">
      <a href="${older ? `post-${older.slug}.html` : 'index.html'}">${older ? '<span>上一篇</span>' + esc(older.title) : '<span>返回</span>回到首页'}</a>
      <a href="${newer ? `post-${newer.slug}.html` : 'index.html'}" style="text-align:right">${newer ? '<span>下一篇</span>' + esc(newer.title) : '<span>返回</span>回到首页'}</a>
    </nav>`;

  return `${head({ title: `${p.title} · ${SITE.name}`, desc: p.summary })}
<main>
  <article class="article wrap">
    <div class="kicker">${esc(b ? b.name : '未分类')}</div>
    <h1>${esc(p.title)}</h1>
    <div class="meta">
      <span>${p.date.slice(0, 4)} 年 ${Number(p.date.slice(5, 7))} 月 ${Number(p.date.slice(8, 10))} 日</span>
      <span>约 ${min} 分钟</span>
    </div>

    <div class="prose">
${p.html}
    </div>

    <div class="article-end">写于 ${p.date.slice(0, 4)} 年 ${Number(p.date.slice(5, 7))} 月。</div>
${pager}
  </article>
</main>
${foot()}`;
}

/* ---------------- 关于页 ---------------- */

function renderAbout() {
  active = 'about';
  const file = path.join(SRC, 'about.md');
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const { meta, body } = parseFrontMatter(raw);
  return `${head({ title: `关于 · ${SITE.name}`, desc: meta.summary || '' })}
<main>
  <section class="page-head wrap">
    <span class="label">About</span>
    <h1>${esc(meta.title || '关于这个站')}</h1>
  </section>

  <section class="wrap about-body">
${mdToHtml(body)}
  </section>
</main>
${foot()}`;
}

/* ---------------- RSS ---------------- */

function renderFeed(posts) {
  const items = posts.map((p) => {
    const b = SITE.boards.find((x) => x.id === p.board);
    const d = new Date(p.date + 'T10:00:00+08:00').toUTCString();
    const link = SITE.siteUrl ? `${SITE.siteUrl}/post-${p.slug}.html` : `post-${p.slug}.html`;
    return `    <item>
      <title>${esc(p.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <category>${esc(b ? b.name : '未分类')}</category>
      <pubDate>${d}</pubDate>
      <description>${esc(p.summary)}</description>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(SITE.name)} · ${esc(SITE.tagline)}</title>
    <link>${SITE.siteUrl || 'index.html'}</link>
    <description>${esc(SITE.introSub)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/* ---------------- 写盘 ---------------- */

function write(name, content) {
  fs.writeFileSync(path.join(OUT, name), content);
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const posts = loadPosts();

  write('index.html', renderIndex(posts));
  write('about.html', renderAbout());
  write('feed.xml', renderFeed(posts));
  SITE.boards.forEach((b) => write(`board-${b.id}.html`, renderBoard(b, posts)));
  posts.forEach((p) => write(`post-${p.slug}.html`, renderPost(p, posts)));

  ['styles.css', '404.html', 'robots.txt', '.nojekyll'].forEach((f) => {
    const src = path.join(SRC, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
  });

  const urls = ['index.html', 'about.html', ...SITE.boards.map((b) => `board-${b.id}.html`),
    ...posts.map((p) => `post-${p.slug}.html`)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE.siteUrl}/${u}</loc></url>`).join('\n')}
</urlset>
`);

  console.log(`构建完成：${posts.length} 篇文章，${SITE.boards.length} 个板块`);
  posts.forEach((p) => console.log(`  · ${p.date}  ${p.title}  → post-${p.slug}.html`));
}

main();
