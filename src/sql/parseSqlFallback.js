const TABLE_CONSTRAINT = /^(constraint|primary\s+key|foreign\s+key|unique(\s+key)?|check|index|key|fulltext|spatial)\b/i
const TYPE_WORDS =
  /^(double\s+precision|character\s+varying|timestamp(?:\s+with(?:out)?\s+time\s+zone)?|time(?:\s+with(?:out)?\s+time\s+zone)?|[a-zA-Z]+)/i
const TYPE_STOP =
  /^(not|null|default|primary|unique|references|auto_increment|identity|constraint|check|collate|comment|generated|on|unsigned|zerofill|character\s+set)\b/i

export function unquoteName(value = '') {
  return String(value)
    .trim()
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/["`]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/#[^\n]*/g, ' ')
}

function findMatchingParen(text, openIndex) {
  let depth = 0
  let quote = null
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i]
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '(') depth += 1
    if (ch === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function splitTopLevel(body) {
  const parts = []
  let current = ''
  let depth = 0
  let quote = null
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]
    if (quote) {
      current += ch
      if (ch === quote && body[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      current += ch
      continue
    }
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

function parseIdentifierList(value = '') {
  return value
    .split(',')
    .map((item) => unquoteName(item))
    .filter(Boolean)
}

function addRelation(relations, fromTable, fromColumn, toTable, toColumn) {
  if (!fromTable || !toTable || !fromColumn) return
  const key = `${fromTable}.${fromColumn}->${toTable}.${toColumn || ''}`
  if (relations.some((item) => item.key === key)) return
  relations.push({
    key,
    fromTable,
    fromColumn,
    toTable,
    toColumn: toColumn || '',
  })
}

function parseForeignKey(text, fromTable, relations) {
  const match = text.match(/foreign\s+key\s*\(([^)]+)\)\s*references\s+([^\s(]+)\s*(?:\(([^)]+)\))?/i)
  if (!match) return
  const fromCols = parseIdentifierList(match[1])
  const toTable = unquoteName(match[2])
  const toCols = parseIdentifierList(match[3] || '')
  fromCols.forEach((fromColumn, index) => {
    addRelation(relations, fromTable, fromColumn, toTable, toCols[index] || toCols[0] || '')
  })
}

function parseColumn(part, tableName, relations) {
  const match = part.match(/^((?:`[^`]+`|"[^"]+"|\[[^\]]+\]|[a-zA-Z_][\w$]*))\s+([\s\S]+)$/)
  if (!match) return null

  const name = unquoteName(match[1])
  const rest = match[2].trim()
  const typeMatch = rest.match(TYPE_WORDS)
  let type = (typeMatch?.[0] || rest.split(/\s+/)[0] || 'unknown').replace(/\s+/g, ' ').trim()
  let afterType = rest.slice(typeMatch?.[0].length || type.length).trim()
  if (afterType.startsWith('(')) {
    const close = afterType.indexOf(')')
    if (close !== -1) {
      type += afterType.slice(0, close + 1)
      afterType = afterType.slice(close + 1).trim()
    }
  }
  if (!TYPE_STOP.test(afterType) && afterType.startsWith('varying')) {
    const extra = afterType.match(/^varying(?:\s*\([^)]*\))?/i)
    if (extra) {
      type += ` ${extra[0]}`
      afterType = afterType.slice(extra[0].length).trim()
    }
  }

  const inlineRef = afterType.match(/references\s+([^\s(]+)\s*(?:\(([^)]+)\))?/i)
  if (inlineRef) {
    addRelation(relations, tableName, name, unquoteName(inlineRef[1]), unquoteName(inlineRef[2] || ''))
  }

  return {
    name,
    type,
    pk: /primary\s+key/i.test(afterType),
    fk: Boolean(inlineRef),
  }
}

export function extractCreateTables(sql) {
  const cleaned = stripComments(String(sql || ''))
  const statements = []
  const re =
    /create\s+table(?:\s+if\s+not\s+exists)?\s+((?:"[^"]+"|[a-zA-Z_]\w*)(?:\s*\.\s*(?:"[^"]+"|[a-zA-Z_]\w*))?)\s*(partition\s+of\b)?\s*\(/gi
  let match
  while ((match = re.exec(cleaned))) {
    if (match[2]) continue
    const open = match.index + match[0].length - 1
    const close = findMatchingParen(cleaned, open)
    if (close === -1) continue
    statements.push({
      name: unquoteName(match[1]),
      sql: cleaned.slice(match.index, close + 1),
      body: cleaned.slice(open + 1, close),
    })
  }
  return { cleaned, statements }
}

export function parseSqlFallback(sql) {
  const { cleaned, statements } = extractCreateTables(sql)
  const tables = []
  const relations = []
  const seen = new Set()

  statements.forEach((statement) => {
    if (!statement.name || seen.has(statement.name.toLowerCase())) return
    seen.add(statement.name.toLowerCase())
    const columns = []
    const pkCols = new Set()
    splitTopLevel(statement.body).forEach((part) => {
      if (TABLE_CONSTRAINT.test(part)) {
        const pk = part.match(/primary\s+key\s*\(([^)]+)\)/i)
        if (pk) parseIdentifierList(pk[1]).forEach((col) => pkCols.add(col))
        parseForeignKey(part, statement.name, relations)
        return
      }
      const column = parseColumn(part, statement.name, relations)
      if (column) columns.push(column)
    })
    columns.forEach((column) => {
      if (pkCols.has(column.name)) column.pk = true
    })
    tables.push({ name: statement.name, columns })
  })

  const alter =
    /alter\s+table\s+([^\s(]+)\s+[\s\S]*?foreign\s+key\s*\(([^)]+)\)\s*references\s+([^\s(]+)\s*(?:\(([^)]+)\))?/gi
  let match
  while ((match = alter.exec(cleaned))) {
    parseIdentifierList(match[2]).forEach((fromColumn, index) => {
      addRelation(
        relations,
        unquoteName(match[1]),
        fromColumn,
        unquoteName(match[3]),
        parseIdentifierList(match[4] || '')[index] || '',
      )
    })
  }

  relations.forEach((relation) => {
    const from = tables.find((table) => table.name.toLowerCase() === relation.fromTable.toLowerCase())
    const column = from?.columns.find((item) => item.name.toLowerCase() === relation.fromColumn.toLowerCase())
    if (column) column.fk = true
  })

  return { tables, relations }
}
