import { Octokit } from '@octokit/rest';

const POSTS_DIR    = 'content';
const PROJECTS_DIR = 'content/projects';
const ABOUT_FILE   = 'content/about.md';
const IMAGES_DIR   = 'public/images';

function getOctokit() {
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set.');
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

function getRepo() {
  return {
    owner:  process.env.GITHUB_OWNER,
    repo:   process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || 'main',
  };
}

// ── Internal: read a single file ──────────────────────────────
async function readFile(path) {
  const octokit = getOctokit();
  const { owner, repo, branch } = getRepo();
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
  if (Array.isArray(data)) throw new Error('Expected file, got directory');
  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  };
}

// ── Internal: commit a file ────────────────────────────────────
async function writeFile(path, content, message, sha = null) {
  const octokit = getOctokit();
  const { owner, repo, branch } = getRepo();
  const isRaw = content && content.__raw === true;
  const encoded = isRaw
    ? content.data
    : Buffer.from(content, 'utf-8').toString('base64');
  const params = { owner, repo, path, branch, message, content: encoded };
  if (sha) params.sha = sha;
  const { data } = await octokit.repos.createOrUpdateFileContents(params);
  return data;
}

// ── Internal: delete a file ────────────────────────────────────
async function removeFile(path, sha, message) {
  const octokit = getOctokit();
  const { owner, repo, branch } = getRepo();
  return octokit.repos.deleteFile({ owner, repo, path, branch, message, sha });
}

// ── Internal: list a directory ─────────────────────────────────
async function listDir(path) {
  try {
    const octokit = getOctokit();
    const { owner, repo, branch } = getRepo();
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

// ══════════════════════════════════════════
// POSTS  →  content/*.md
// ══════════════════════════════════════════
export async function getAllPostsFromGitHub() {
  const files = await listDir(POSTS_DIR);
  return files
    .filter(f => f.type === 'file' && f.name.endsWith('.md') && f.name !== 'about.md')
    .map(f => ({ name: f.name, slug: f.name.replace(/\.md$/, ''), sha: f.sha }));
}

export async function getPostFromGitHub(slug) {
  return readFile(`${POSTS_DIR}/${slug}.md`);
}

export async function uploadPostToGitHub(filename, content, sha = null) {
  return writeFile(`${POSTS_DIR}/${filename}`, content, `docs: ${sha ? 'update' : 'add'} post ${filename}`, sha);
}

export async function deletePostFromGitHub(slug, sha) {
  return removeFile(`${POSTS_DIR}/${slug}.md`, sha, `docs: remove post ${slug}`);
}

// ══════════════════════════════════════════
// PROJECTS  →  content/projects/*.md
// ══════════════════════════════════════════
export async function getAllProjectsFromGitHub() {
  const files = await listDir(PROJECTS_DIR);
  return files
    .filter(f => f.type === 'file' && f.name.endsWith('.md'))
    .map(f => ({ name: f.name, slug: f.name.replace(/\.md$/, ''), sha: f.sha }));
}

export async function getProjectFromGitHub(slug) {
  return readFile(`${PROJECTS_DIR}/${slug}.md`);
}

export async function uploadProjectToGitHub(filename, content, sha = null) {
  return writeFile(`${PROJECTS_DIR}/${filename}`, content, `docs: ${sha ? 'update' : 'add'} project ${filename}`, sha);
}

export async function deleteProjectFromGitHub(slug, sha) {
  return removeFile(`${PROJECTS_DIR}/${slug}.md`, sha, `docs: remove project ${slug}`);
}

// ══════════════════════════════════════════
// ABOUT PAGE  →  content/about.md
// ══════════════════════════════════════════
export async function getAboutFromGitHub() {
  try { return await readFile(ABOUT_FILE); }
  catch (e) {
    if (e.status === 404) return { content: '', sha: null };
    throw e;
  }
}

export async function uploadAboutToGitHub(content, sha = null) {
  return writeFile(ABOUT_FILE, content, 'docs: update about page', sha);
}

// ══════════════════════════════════════════
// IMAGES  →  public/images/*
// ══════════════════════════════════════════
export async function uploadImageToGitHub(filename, base64Data, sha = null) {
  return writeFile(
    `${IMAGES_DIR}/${filename}`,
    { __raw: true, data: base64Data },
    `assets: upload image ${filename}`,
    sha
  );
}

export async function getAllImagesFromGitHub() {
  const files = await listDir(IMAGES_DIR);
  return files
    .filter(f => f.type === 'file' && /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name))
    .map(f => ({ name: f.name, sha: f.sha, url: `/images/${f.name}` }));
}

export async function deleteImageFromGitHub(filename, sha) {
  return removeFile(`${IMAGES_DIR}/${filename}`, sha, `assets: remove image ${filename}`);
}
