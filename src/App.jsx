import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import './App.css'

function isMarkdownFile(file) {
  if (!file) return false
  const name = file.name.toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown') || file.type === 'text/markdown'
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
  const [markdown, setMarkdown] = useState('')
  const [view, setView] = useState('preview')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const dragCount = useRef(0)
  const hasFile = Boolean(fileName && markdown)

  const loadFile = useCallback((file) => {
    if (!file) return
    if (!isMarkdownFile(file)) {
      setError('Please choose a .md or .markdown file.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setMarkdown(String(reader.result || ''))
      setFileName(file.name)
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

  const openPicker = () => inputRef.current?.click()

  return (
    <div className={`app${dragging ? ' is-dragging' : ''}${hasFile ? ' has-file' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            MD
          </span>
          <div>
            <h1>Markdown Preview</h1>
            <p>Read a file on this computer</p>
          </div>
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        hidden
        onChange={(event) => {
          loadFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {error ? <div className="banner">{error}</div> : null}

      <main className="stage">
        {!hasFile ? (
          <section className="home">
            <button type="button" className="upload-card" onClick={openPicker}>
              <span className="upload-icon" aria-hidden="true">
                ↑
              </span>
              <strong>Upload a Markdown file</strong>
              <span>Click here or drag a .md file onto this page</span>
              <em>Choose .md file</em>
            </button>
            <ul className="home-tips">
              <li>Works offline — the file stays on your computer</li>
              <li>Preview it as a readable page</li>
              <li>Print it, or choose Save as PDF in the print dialog</li>
            </ul>
          </section>
        ) : (
          <>
            <section className="reader-tools">
              <button type="button" className="upload-inline" onClick={openPicker}>
                <span className="upload-icon small" aria-hidden="true">
                  ↑
                </span>
                <span>
                  <strong>Upload another file</strong>
                  <small>Click or drop a .md file to replace this one</small>
                </span>
              </button>

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

            <article className={`paper markdown-body${view === 'source' ? ' paper-hidden' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {markdown}
              </ReactMarkdown>
            </article>
            {view === 'source' ? <pre className="source">{markdown}</pre> : null}
          </>
        )}
      </main>

      {dragging ? (
        <div className="drop-overlay">
          <div className="drop-card">Drop your Markdown file to open it</div>
        </div>
      ) : null}
    </div>
  )
}
