import { Parser } from 'node-sql-parser'
import { extractCreateTables, parseSqlFallback, unquoteName } from './parseSqlFallback.js'

const parser = new Parser()
const DIALECTS = ['MySQL', 'PostgresQL', 'MariaDB', 'Sqlite', 'TransactSQL']

function columnName(value) {
  if (!value) return ''
  if (typeof value === 'string') return unquoteName(value)
  if (typeof value.column === 'string') return unquoteName(value.column)
  return unquoteName(value.column?.expr?.value || value.value || value.table || '')
}

function columnType(definition = {}) {
  const dataType = definition.dataType || definition.type || 'unknown'
  const length = definition.length ?? definition.scale
  if (Array.isArray(length)) return `${dataType}(${length.join(', ')})`
  if (length != null && definition.scale != null) return `${dataType}(${length}, ${definition.scale})`
  if (length != null) return `${dataType}(${length})`
  return String(dataType)
}

function astify(sql) {
  for (const database of DIALECTS) {
    try {
      return parser.astify(sql, { database })
    } catch {
      // try the next dialect
    }
  }
  return null
}

function addRelation(relations, fromTable, fromColumn, toTable, toColumn) {
  if (!fromTable || !toTable || !fromColumn) return
  const key = `${fromTable}.${fromColumn}->${toTable}.${toColumn || ''}`
  if (relations.some((item) => item.key === key)) return
  relations.push({ key, fromTable, fromColumn, toTable, toColumn: toColumn || '' })
}

function fromCreateAst(ast, relations) {
  const name = unquoteName(ast.table?.[0]?.table || ast.table?.[0]?.name || '')
  if (!name) return null

  const columns = []
  const pkCols = new Set()
  const defs = ast.create_definitions || ast.definitions || []

  defs.forEach((def) => {
    if (def.resource === 'column' || def.column) {
      const colName = columnName(def.column)
      if (!colName) return
      const ref = def.reference_definition
      if (ref?.table?.[0]?.table) {
        addRelation(relations, name, colName, unquoteName(ref.table[0].table), columnName(ref.definition?.[0]))
      }
      if (String(def.primary_key || '').toLowerCase().includes('primary')) pkCols.add(colName)
      columns.push({
        name: colName,
        type: columnType(def.definition),
        pk: pkCols.has(colName),
        fk: Boolean(ref),
      })
      return
    }

    const type = String(def.constraint_type || def.keyword || '').toLowerCase()
    if (type.includes('primary')) {
      ;(def.definition || []).forEach((item) => pkCols.add(columnName(item)))
    }
    if (type.includes('foreign') && def.reference_definition) {
      const toTable = unquoteName(def.reference_definition.table?.[0]?.table || '')
      const fromCols = (def.definition || []).map(columnName)
      const toCols = (def.reference_definition.definition || []).map(columnName)
      fromCols.forEach((fromColumn, index) => {
        addRelation(relations, name, fromColumn, toTable, toCols[index] || toCols[0] || '')
      })
    }
  })

  columns.forEach((column) => {
    if (pkCols.has(column.name)) column.pk = true
  })

  return { name, columns }
}

function parseWithLibrary(sql) {
  const { statements } = extractCreateTables(sql)
  const tables = []
  const relations = []
  const seen = new Set()

  statements.forEach((statement) => {
    const ast = astify(statement.sql)
    const list = Array.isArray(ast) ? ast : ast ? [ast] : []
    list.forEach((item) => {
      if (!item || item.type !== 'create') return
      const table = fromCreateAst(item, relations)
      if (!table || seen.has(table.name.toLowerCase())) return
      seen.add(table.name.toLowerCase())
      tables.push(table)
    })
  })

  relations.forEach((relation) => {
    const from = tables.find((table) => table.name.toLowerCase() === relation.fromTable.toLowerCase())
    const column = from?.columns.find((item) => item.name.toLowerCase() === relation.fromColumn.toLowerCase())
    if (column) column.fk = true
  })

  return { tables, relations }
}

export function parseSqlSchema(sql) {
  const fallback = parseSqlFallback(sql)
  try {
    const parsed = parseWithLibrary(sql)
    if (parsed.tables.length > fallback.tables.length) return parsed
  } catch {
    // PostgreSQL dumps often fail in node-sql-parser; keep the fuller fallback
  }
  return fallback
}
