import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import SqlPreview from './SqlPreview.jsx'
import './App.css'

function getFileKind(file) {
  if (!file) return null
  const name = file.name.toLowerCase()
  if (name.endsWith('.md') || name.endsWith('.markdown') || file.type === 'text/markdown') {
    return 'markdown'
  }
  if (name.endsWith('.sql') || file.type === 'application/sql' || file.type === 'text/sql') {
    return 'sql'
  }
  return null
}

const markdownComponents = {
  table: ({ children }) => (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  ),
}

export default function App() {
  const [fileName, setFileName] = useState('')
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('markdown')
  const [view, setView] = useState('preview')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const mdInputRef = useRef(null)
  const sqlInputRef = useRef(null)
  const dragCount = useRef(0)
  const hasFile = Boolean(fileName)

  const loadFile = useCallback((file, expectedKind) => {
    if (!file) return
    const nextKind = getFileKind(file)
    if (expectedKind && nextKind !== expectedKind) {
      setError(expectedKind === 'sql' ? 'Please choose a .sql file.' : 'Please choose a .md or .markdown file.')
      return
    }
    if (!nextKind) {
      setError('Please choose a .md or .sql file.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setContent(String(reader.result || ''))
      setFileName(file.name)
      setKind(nextKind)
      setView('preview')
      setError('')
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)
  }, [])

  useEffect(() => {
    const onDragEnter = (event) => {
      event.preventDefault()
      dragCount.current += 1
      setDragging(true)
    }
    const onDragOver = (event) => event.preventDefault()
    const onDragLeave = (event) => {
      event.preventDefault()
      dragCount.current = Math.max(0, dragCount.current - 1)
      if (dragCount.current === 0) setDragging(false)
    }
    const onDrop = (event) => {
      event.preventDefault()
      dragCount.current = 0
      setDragging(false)
      const file = event.dataTransfer?.files?.[0]
      loadFile(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [loadFile])

  const printDoc = () => {
    setView('preview')
    setTimeout(() => window.print(), 50)
  }

  const openPicker = (nextKind) => {
    if (nextKind === 'sql') sqlInputRef.current?.click()
    else mdInputRef.current?.click()
  }

  return (
    <div className={`app${dragging ? ' is-dragging' : ''}${hasFile ? ' has-file' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            MD
          </span>
          <div>
            <h1>File Preview</h1>
            <p>Read Markdown or SQL on this computer</p>
          </div>
        </div>
      </header>

      <input
        ref={mdInputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        hidden
        onChange={(event) => {
          loadFile(event.target.files?.[0], 'markdown')
          event.target.value = ''
        }}
      />
      <input
        ref={sqlInputRef}
        type="file"
        accept=".sql,application/sql,text/sql"
        hidden
        onChange={(event) => {
          loadFile(event.target.files?.[0], 'sql')
          event.target.value = ''
        }}
      />

      {error ? <div className="banner">{error}</div> : null}

      <main className="stage">
        {!hasFile ? (
          <section className="home">
            <h2 className="home-title">Choose a file type</h2>
            <p className="home-lead">Upload Markdown or SQL. Each option only accepts that file type.</p>
            <div className="upload-grid">
              <button type="button" className="upload-card" onClick={() => openPicker('markdown')}>
                <span className="upload-icon" aria-hidden="true">
                  MD
                </span>
                <strong>Upload Markdown</strong>
                <span>Open a .md file as a readable page</span>
                <em>Choose .md file</em>
              </button>
              <button type="button" className="upload-card sql" onClick={() => openPicker('sql')}>
                <span className="upload-icon" aria-hidden="true">
                  SQL
                </span>
                <strong>Upload SQL</strong>
                <span>Open a .sql file with highlighting</span>
                <em>Choose .sql file</em>
              </button>
            </div>
            <ul className="home-tips">
              <li>Works offline — the file stays on your computer</li>
              <li>You can also drop a .md or .sql file onto this page</li>
              <li>Print it, or choose Save as PDF in the print dialog</li>
            </ul>
          </section>
        ) : (
          <>
            <section className="reader-tools">
              <div className="upload-inline-row">
                <button type="button" className="upload-inline" onClick={() => openPicker('markdown')}>
                  <span className="upload-icon small" aria-hidden="true">
                    MD
                  </span>
                  <span>
                    <strong>Upload Markdown</strong>
                    <small>Replace with a .md file</small>
                  </span>
                </button>
                <button type="button" className="upload-inline sql" onClick={() => openPicker('sql')}>
                  <span className="upload-icon small sql" aria-hidden="true">
                    SQL
                  </span>
                  <span>
                    <strong>Upload SQL</strong>
                    <small>Replace with a .sql file</small>
                  </span>
                </button>
              </div>

              <div className="doc-bar">
                <div className="file-chip" title={fileName}>
                  {fileName}
                </div>
                <div className="doc-actions">
                  <div className="segment" role="tablist" aria-label="View">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'preview'}
                      className={view === 'preview' ? 'active' : ''}
                      onClick={() => setView('preview')}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'source'}
                      className={view === 'source' ? 'active' : ''}
                      onClick={() => setView('source')}
                    >
                      Source
                    </button>
                  </div>
                  <button type="button" className="btn primary" onClick={printDoc}>
                    Print / PDF
                  </button>
                </div>
              </div>
            </section>

            {kind === 'sql' ? (
              <div className={view === 'source' ? 'paper-hidden' : ''}>
                <SqlPreview content={content} fileName={fileName} />
              </div>
            ) : (
              <article className={`paper markdown-body${view === 'source' ? ' paper-hidden' : ''}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={markdownComponents}
                >
                  {content}
                </ReactMarkdown>
              </article>
            )}
            {view === 'source' ? <pre className="source">{content}</pre> : null}
          </>
        )}
      </main>

      {dragging ? (
        <div className="drop-overlay">
          <div className="drop-card">Drop a .md or .sql file to open it</div>
        </div>
      ) : null}
    </div>
  )
}
