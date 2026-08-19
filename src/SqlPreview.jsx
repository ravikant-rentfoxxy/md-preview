import { useMemo } from 'react'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'

hljs.registerLanguage('sql', sql)

function splitStatements(text) {
  const parts = text
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts : [text]
}

function highlightSql(code) {
  return hljs.highlight(code, { language: 'sql', ignoreIllegals: true }).value
}

export default function SqlPreview({ content, fileName }) {
  const statements = useMemo(() => splitStatements(content), [content])
  const showBlocks = statements.length > 1

  return (
    <article className="paper sql-paper">
      <header className="sql-header">
        <h1>{fileName}</h1>
        <p>
          {showBlocks ? `${statements.length} statements` : 'SQL file'} · readable preview
        </p>
      </header>

      {showBlocks ? (
        <ol className="sql-list">
          {statements.map((statement, index) => (
            <li key={`${index}-${statement.slice(0, 24)}`} className="sql-block">
              <pre>
                <code
                  className="hljs language-sql"
                  dangerouslySetInnerHTML={{ __html: highlightSql(statement) }}
                />
              </pre>
            </li>
          ))}
        </ol>
      ) : (
        <pre className="sql-single">
          <code
            className="hljs language-sql"
            dangerouslySetInnerHTML={{ __html: highlightSql(content) }}
          />
        </pre>
      )}
    </article>
  )
}
