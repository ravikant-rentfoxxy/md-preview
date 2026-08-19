import { Handle, Position } from '@xyflow/react'

export default function TableNode({ data, selected }) {
  return (
    <article className={`erd-table${selected ? ' is-selected' : ''}`} style={{ borderTopColor: data.color }}>
      <header className="erd-table-head" style={{ background: data.color }}>
        {data.name.includes('.') ? <small>{data.name.split('.').slice(0, -1).join('.')}</small> : null}
        <span>{data.name.split('.').at(-1)}</span>
      </header>
      <Handle type="target" position={Position.Left} className="erd-handle" isConnectable={false} />
      <ul>
        {data.columns.map((column) => (
          <li key={column.name}>
            <span className={column.pk ? 'is-pk' : column.fk ? 'is-fk' : ''}>{column.name}</span>
            <small>{column.type}</small>
          </li>
        ))}
      </ul>
      <Handle type="source" position={Position.Right} className="erd-handle" isConnectable={false} />
    </article>
  )
}
