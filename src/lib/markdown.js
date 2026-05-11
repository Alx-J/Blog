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

// ── Sanitize schema — safe HTML only ──────────────────────────
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
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
};

// ── Obsidian preprocessing ────────────────────────────────────
function preprocessObsidian(md) {
  // ![[image.png]] or ![[image.png|alt]] → standard markdown image
  // Points to /images/ which is where admin uploads land
  md = md.replace(/!\[\[([^\]]+)\]\]/g, (_, inner) => {
    const [rawPath, alt] = inner.split('|');
    const filename = rawPath.trim().split(/[/\\]/).pop(); // strip vault path
    const altText = (alt || filename).trim();
    return `![${altText}](/images/${filename})`;
  });

  // [[wikilink]] → plain text (no broken links)
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
      if (typeof v === 'string') {
        safe[k] = sanitizeHtml(v, { allowedTags: [], allowedAttributes: {} });
      } else if (Array.isArray(v)) {
        safe[k] = v.map(i =>
          typeof i === 'string'
            ? sanitizeHtml(i, { allowedTags: [], allowedAttributes: {} })
            : i
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
// NOTE: We only block truly dangerous server-side threats here.
// XSS in rendered output is handled by rehype-sanitize during render.
export function validateMarkdownFile(filename, content) {
  const errors = [];

  if (!filename || typeof filename !== 'string') {
    errors.push('Filename is required.');
    return errors;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(filename)) {
    errors.push('Filename must be lowercase letters, numbers and hyphens only. Example: my-post.md');
  }
  if (filename.length > 100) {
    errors.push('Filename too long (max 100 characters).');
  }
  if (!content || typeof content !== 'string') {
    errors.push('File content is empty.');
  }
  if (content && content.length > 500_000) {
    errors.push('File too large (max 500KB).');
  }

  // Only block actual script injection — not security writeup content
  const trulyDangerous = [
    { re: /<script[\s\S]*?<\/script>/gi, label: 'embedded <script> tags' },
    { re: /data:text\/html[^"'\s]*/gi,    label: 'data:text/html URIs' },
    { re: /<\?php/gi,                     label: 'PHP code' },
  ];
  for (const { re, label } of trulyDangerous) {
    if (re.test(content)) {
      errors.push(`Content contains ${label} which are not allowed.`);
      break;
    }
  }

  return errors;
}

// ── Build post/project metadata ───────────────────────────────
export function buildPostMeta(frontmatter, slug) {
  return {
    title:       frontmatter.title       || slug.replace(/-/g, ' '),
    date:        frontmatter.date
      ? new Date(frontmatter.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Unknown date',
    rawDate:     frontmatter.date        || '1970-01-01',
    category:    frontmatter.category   || frontmatter.type || 'Write-up',
    tags:        Array.isArray(frontmatter.tags) ? frontmatter.tags : (frontmatter.tags ? [frontmatter.tags] : []),
    description: frontmatter.description || frontmatter.excerpt || '',
    slug,
  };
}

export function buildProjectMeta(frontmatter, slug) {
  return {
    title:       frontmatter.title       || slug.replace(/-/g, ' '),
    description: frontmatter.description || '',
    tags:        Array.isArray(frontmatter.tags) ? frontmatter.tags : (frontmatter.tags ? [frontmatter.tags] : []),
    status:      frontmatter.status      || 'wip',
    repo:        frontmatter.repo        || null,
    rawDate:     frontmatter.date        || '1970-01-01',
    slug,
  };
}

export function estimateReadTime(text) {
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}
