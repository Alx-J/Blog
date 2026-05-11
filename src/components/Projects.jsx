import Link from 'next/link';

export default function Projects({ projects = [] }) {
  return (
    <section className="projects section" id="projects">
      <div className="projects-inner">
        <div className="section-header reveal">
          <div>
            <p className="section-label">Projects</p>
            <h2 className="section-title">The <span>Arsenal</span></h2>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="admin-empty" style={{ border: '1px dashed var(--border-red)' }}>
            <p>No projects yet — check back soon</p>
          </div>
        ) : (
          <div className="projects-list">
            {projects.map((p, i) => (
              <Link
                href={`/projects/${p.slug}`}
                className="project-item"
                key={p.slug}
              >
                <div className="project-index">{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <div className="project-name">{p.title}</div>
                  <div className="project-desc">{p.description}</div>
                </div>
                <div className="project-tags">
                  {p.tags?.map(t => <span className="tag" key={t}>{t}</span>)}
                </div>
                <div className={`project-status status-${p.status === 'live' ? 'live' : 'wip'}`}>
                  <div className="status-dot" />
                  {p.status === 'live' ? 'Live' : 'WIP'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
