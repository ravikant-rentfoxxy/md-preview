import dagrePkg from 'dagre'

const dagre = dagrePkg.graphlib ? dagrePkg : dagrePkg.default || dagrePkg

export const TABLE_WIDTH = 248
export const HEADER_HEIGHT = 38
export const ROW_HEIGHT = 28

export const TABLE_COLORS = [
  '#e76f51',
  '#9b87c9',
  '#6a994e',
  '#7b2cbf',
  '#48cae4',
  '#f4a261',
  '#577590',
  '#f9c74f',
  '#2a9d8f',
  '#d62828',
]

export function tableHeight(columnCount) {
  return HEADER_HEIGHT + Math.max(columnCount, 1) * ROW_HEIGHT + 8
}

export function layoutTables(tables, relations) {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 48,
    ranksep: 90,
    marginx: 32,
    marginy: 32,
  })

  tables.forEach((table) => {
    graph.setNode(table.name, {
      width: TABLE_WIDTH,
      height: tableHeight(table.columns.length),
    })
  })

  relations.forEach((relation) => {
    if (!graph.hasNode(relation.toTable) || !graph.hasNode(relation.fromTable)) return
    if (relation.toTable === relation.fromTable) return
    graph.setEdge(relation.toTable, relation.fromTable)
  })

  dagre.layout(graph)

  return tables.map((table, index) => {
    const node = graph.node(table.name) || { x: 80 + index * 40, y: 80 + index * 40 }
    return {
      ...table,
      color: TABLE_COLORS[index % TABLE_COLORS.length],
      x: Math.round(node.x - TABLE_WIDTH / 2),
      y: Math.round(node.y - tableHeight(table.columns.length) / 2),
      width: TABLE_WIDTH,
      height: tableHeight(table.columns.length),
    }
  })
}
