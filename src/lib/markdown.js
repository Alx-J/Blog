import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';
import matter from 'gray-matter';
import sanitizeHtml from 'sanitize-html';

// ── Sanitize schema ────────────────────────────────────────────
// FIX: add '' (empty string) to src/href protocols so relative
// paths like /images/photo.png are NOT stripped by rehype-sanitize
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    span: [...(defaultSchema.attributes?.span || []), 'className'],
    div:  [...(defaultSchema.attributes?.div  || []), 'className'],
    img:  ['src', 'alt', 'title', 'width', 'height'],
    a:    ['href', 'title', 'target', 'rel'],
  },
  // Allow relative URLs (e.g. /images/photo.png) in addition to http/https
  protocols: {
    ...defaultSchema.protocols,
    src:  [...(defaultSchema.protocols?.src  || ['http', 'https']), ''],
    href: [...(defaultSchema.protocols?.href || ['http', 'https', 'mailto']), ''],
  },
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
};

// ── Date helper ────────────────────────────────────────────────
// FIX: gray-matter parses unquoted YAML dates (date: 2025-01-15)
// as JavaScript Date objects. Next.js getStaticProps cannot serialize
// Date objects to JSON — convert everything to a plain string.
function toSafeDate(value) {
  if (!value) return '1970-01-01';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value);
}

// ── Obsidian preprocessing ────────────────────────────────────
function preprocessObsidian(md) {
  // ![[image.png]] or ![[image.png|alt]] or ![[/images/image.png]]
  // → standard markdown image pointing to /images/filename
  md = md.replace(/!\[\[([^\]]+)\]\]/g, (_, inner) => {
    const [rawPath, alt] = inner.split('|');
    const filename = rawPath.trim().split(/[/\\]/).pop();
    const altText  = (alt || filename).trim();
    return `![${altText}](/images/${filename})`;
  });

  // [[wikilink]] → plain styled span
  md = md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, alias) =>
    `<span class="wikilink" title="Wikilink: ${link.trim()}">${(alias || link).trim()}</span>`
  );

  // ==highlight== → <mark>
  md = md.replace(/==(.+?)==/g, '<mark>$1</mark>');

  return md;
}

// ── Parse frontmatter ─────────────────────────────────────────
export function parseFrontmatter(rawContent) {
  try {
    const { data, content } = matter(rawContent);
    const safe = {};
    for (const [k, v] of Object.entries(data)) {
      if (v instanceof Date) {
        // Serialize Date objects immediately — never pass them to Next.js props
        safe[k] = v.toISOString().split('T')[0];
      } else if (typeof v === 'string') {
        safe[k] = sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} });
      } else if (Array.isArray(v)) {
        safe[k] = v.map(i =>
          i instanceof Date   ? i.toISOString().split('T')[0] :
          typeof i === 'string' ? sanitizeHtml(i, { allowedTags: [], allowedAttributes: {} }) :
          i
        );
      } else {
        safe[k] = v;
      }
    }
    return { frontmatter: safe, body: content };
  } catch {
    return { frontmatter: {}, body: rawContent };
  }
}

// ── Render markdown → safe HTML ───────────────────────────────
export async function renderMarkdown(markdownBody) {
  const preprocessed = preprocessObsidian(markdownBody);
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeStringify)
    .process(preprocessed);
  return String(result);
}

// ── Validate .md file before storage ─────────────────────────
export function validateMarkdownFile(filename, content) {
  const errors = [];
  if (!filename || typeof filename !== 'string') {
    errors.push('Filename is required.'); return errors;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(filename)) {
    errors.push('Filename must be lowercase letters, numbers and hyphens only. Example: my-post.md');
  }
  if (filename.length > 100) errors.push('Filename too long (max 100 chars).');
  if (!content || typeof content !== 'string') errors.push('File content is empty.');
  if (content && content.length > 500_000) errors.push('File too large (max 500KB).');

  // Only block actual dangerous server-side patterns
  // (NOT on\w+= patterns — those are valid in CTF/security writeups)
  const dangerous = [
    { re: /<script[\s\S]*?<\/script>/gi, label: 'embedded <script> tags' },
    { re: /data:text\/html[^"'\s]*/gi,    label: 'data:text/html URIs' },
    { re: /<\?php/gi,                     label: 'PHP code' },
  ];
  for (const { re, label } of dangerous) {
    if (re.test(content)) {
      errors.push(`Content contains ${label} which are not allowed.`); break;
    }
  }
  return errors;
}

// ── Build post metadata ───────────────────────────────────────
export function buildPostMeta(frontmatter, slug) {
  // FIX: use toSafeDate() so rawDate is always a plain string,
  // never a Date object that would crash Next.js JSON serialization
  const rawDate = toSafeDate(frontmatter.date);
  return {
    title:       frontmatter.title       || slug.replace(/-/g, ' '),
    date:        frontmatter.date
      ? new Date(rawDate).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : 'Unknown date',
    rawDate,
    category:    frontmatter.category   || frontmatter.type || 'Write-up',
    tags:        Array.isArray(frontmatter.tags)
      ? frontmatter.tags
      : (frontmatter.tags ? [String(frontmatter.tags)] : []),
    description: frontmatter.description || frontmatter.excerpt || '',
    slug,
  };
}

// ── Build project metadata ────────────────────────────────────
export function buildProjectMeta(frontmatter, slug) {
  const rawDate = toSafeDate(frontmatter.date);
  return {
    title:       frontmatter.title       || slug.replace(/-/g, ' '),
    description: frontmatter.description || '',
    tags:        Array.isArray(frontmatter.tags)
      ? frontmatter.tags
      : (frontmatter.tags ? [String(frontmatter.tags)] : []),
    status:      frontmatter.status      || 'wip',
    repo:        frontmatter.repo        || null,
    rawDate,
    slug,
  };
}

// ── Estimate read time ────────────────────────────────────────
export function estimateReadTime(text) {
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}
