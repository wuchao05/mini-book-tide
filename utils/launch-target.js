const { isDirectBShellPath, normalizePagePath } = require('./shell-pages')

function parseTargetQuery(rawQuery) {
  if (!rawQuery) {
    return {}
  }

  try {
    const parsedQuery = JSON.parse(rawQuery)
    return parsedQuery && typeof parsedQuery === 'object' ? parsedQuery : {}
  } catch (error) {
    console.warn('解析目标参数失败', error)
    return {}
  }
}

function buildTargetQuery(query) {
  const nextQuery = Object.assign({}, query || {})

  delete nextQuery.target_path
  delete nextQuery.target_query

  return nextQuery
}

function resolveLaunchTarget(path, query) {
  const normalizedQuery = query && typeof query === 'object' ? Object.assign({}, query) : {}
  const fallbackQuery = buildTargetQuery(normalizedQuery)
  const targetPath = normalizePagePath(normalizedQuery.target_path || '')

  if (targetPath) {
    const targetQuery = normalizedQuery.target_query
      ? parseTargetQuery(normalizedQuery.target_query)
      : fallbackQuery

    return {
      entryPath: targetPath,
      entryQuery: Object.assign({}, fallbackQuery, targetQuery),
      hasTarget: true,
      source: 'query',
    }
  }

  const normalizedPath = normalizePagePath(path || '')
  if (isDirectBShellPath(normalizedPath)) {
    return {
      entryPath: normalizedPath,
      entryQuery: normalizedQuery,
      hasTarget: true,
      source: 'path',
    }
  }

  return {
    entryPath: '',
    entryQuery: fallbackQuery,
    hasTarget: false,
    source: Object.keys(fallbackQuery).length ? 'query' : '',
  }
}

module.exports = {
  parseTargetQuery,
  buildTargetQuery,
  resolveLaunchTarget,
}
