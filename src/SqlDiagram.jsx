import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { parseSqlSchema } from './sql/parseSqlSchema.js'
import { layoutTables } from './sql/layoutTables.js'
import TableNode from './sql/TableNode.jsx'
import '@xyflow/react/dist/style.css'
import './SqlDiagram.css'

const nodeTypes = { sqlTable: TableNode }

function toFlow(tables, relations) {
  const nodes = tables.map((table) => ({
    id: table.name,
    type: 'sqlTable',
    position: { x: table.x, y: table.y },
    data: {
      name: table.name,
      columns: table.columns,
      color: table.color,
    },
  }))

  const findName = (name) => tables.find((table) => table.name.toLowerCase() === String(name).toLowerCase())?.name
  const edges = relations
    .map((relation) => ({
      id: relation.key,
      source: findName(relation.fromTable),
      target: findName(relation.toTable),
    }))
    .filter((relation) => relation.source && relation.target)
    .map((relation) => ({
      ...relation,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#8d99ae', strokeWidth: 1.6 },
    }))

  return { nodes, edges }
}

function DiagramCanvas({ content, fileName, view, onView, onBack, onPrint }) {
  const schema = useMemo(() => {
    try {
      return parseSqlSchema(content)
    } catch {
      return { tables: [], relations: [] }
    }
  }, [content])
  const tables = useMemo(() => layoutTables(schema.tables, schema.relations), [schema])
  const flow = useMemo(() => toFlow(tables, schema.relations), [tables, schema.relations])
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState('')
  const [openTables, setOpenTables] = useState(() => new Set())
  const searchRef = useRef(null)
  const { fitView, setCenter, getNode } = useReactFlow()

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return tables
    return tables.filter((table) => table.name.toLowerCase().includes(query))
  }, [tables, filter])

  useEffect(() => {
    setNodes(flow.nodes)
    setEdges(flow.edges)
    requestAnimationFrame(() => fitView({ padding: 0.18 }))
  }, [flow, setNodes, setEdges, fitView])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const focusTable = useCallback(
    (name) => {
      setSelected(name)
      const node = getNode(name)
      if (!node) return
      const width = node.measured?.width || 248
      const height = node.measured?.height || 120
      setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 1, duration: 240 })
    },
    [getNode, setCenter],
  )

  const onNodeClick = useCallback((_event, node) => {
    setSelected(node.id)
  }, [])

  const submitSearch = (event) => {
    event.preventDefault()
    if (filtered[0]) focusTable(filtered[0].name)
  }

  return (
    <div className="sql-shell">
      <header className="sql-toolbar">
        <button type="button" className="sql-back" onClick={onBack}>
          ← Back
        </button>
        <div className="sql-file" title={fileName}>
          {fileName}
        </div>
        <form className="sql-search" onSubmit={submitSearch}>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search table name…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Search table name"
          />
          <button type="submit">Find</button>
        </form>
        <div className="sql-actions">
          <div className="segment" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'preview'}
              className={view === 'preview' ? 'active' : ''}
              onClick={() => onView('preview')}
            >
              Diagram
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'source'}
              className={view === 'source' ? 'active' : ''}
              onClick={() => onView('source')}
            >
              Source
            </button>
          </div>
          <button type="button" className="btn primary" onClick={onPrint}>
            Print / PDF
          </button>
        </div>
      </header>

      {view === 'source' ? (
        <pre className="sql-source">{content}</pre>
      ) : !tables.length ? (
        <div className="erd-empty">
          <h2>No tables found</h2>
          <p>This SQL file has no CREATE TABLE statements to draw.</p>
        </div>
      ) : (
        <div className="erd">
          <aside className="erd-sidebar">
            <div className="erd-side-head">
              <h2>Tables</h2>
              <span>
                {filtered.length}
                {filter.trim() ? ` / ${tables.length}` : ''}
              </span>
            </div>
            <ul className="erd-table-list">
              {filtered.length ? (
                filtered.map((table) => {
                  const open = openTables.has(table.name) || selected === table.name
                  return (
                    <li key={table.name} className={selected === table.name ? 'is-active' : ''}>
                      <button type="button" className="erd-table-item" onClick={() => focusTable(table.name)}>
                        <i style={{ background: table.color }} />
                        <strong>{table.name}</strong>
                        <em
                          onClick={(event) => {
                            event.stopPropagation()
                            setOpenTables((current) => {
                              const next = new Set(current)
                              if (next.has(table.name)) next.delete(table.name)
                              else next.add(table.name)
                              return next
                            })
                          }}
                        >
                          {open ? '▾' : '▸'}
                        </em>
                      </button>
                      {open ? (
                        <ul className="erd-col-list">
                          {table.columns.map((column) => (
                            <li key={column.name}>
                              <span>
                                {column.pk ? '🔑 ' : ''}
                                {column.name}
                              </span>
                              <small>{column.type}</small>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })
              ) : (
                <li className="erd-empty-list">No table matches “{filter}”</li>
              )}
            </ul>
          </aside>

          <section className="erd-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={1.8}
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
              panOnDrag
              zoomOnScroll
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={22} color="#e8e2d4" />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => node.data?.color || '#2f6f5e'}
                maskColor="rgba(20, 24, 22, 0.08)"
              />
            </ReactFlow>
          </section>
        </div>
      )}
    </div>
  )
}

export default function SqlDiagram(props) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas {...props} />
    </ReactFlowProvider>
  )
}
