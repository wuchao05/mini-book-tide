const BSHELL_HOME = '/pages/book-detail/theater/index'

const BSHELL_PAGE_PATHS = {
  theater: BSHELL_HOME,
  follow: '/pages/book-detail/follow/index',
  mine: '/pages/book-detail/mine/index',
  recharge_record: '/pages/book-detail/recharge/index',
  consume_record: '/pages/book-detail/consume/index',
  forecast: '/pages/book-detail/forecast/index',
}

function normalizePagePath(path) {
  return String(path || '').replace(/^\//, '')
}

function buildQueryString(query) {
  return Object.keys(query || {})
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&')
}

function buildPageUrl(path, query) {
  const normalizedPath = String(path || '')
  if (!normalizedPath) {
    return ''
  }

  const finalPath = normalizedPath.charAt(0) === '/' ? normalizedPath : `/${normalizedPath}`
  const queryString = buildQueryString(query)
  return `${finalPath}${queryString ? `?${queryString}` : ''}`
}

function getBShellPagePath(pageKey) {
  return BSHELL_PAGE_PATHS[pageKey] || ''
}

function buildBShellPageUrl(pageKey, query) {
  return buildPageUrl(getBShellPagePath(pageKey), query)
}

function resolveBShellTabItems(tabBarConfig) {
  return ((tabBarConfig && tabBarConfig.items) || [])
    .map((item) => {
      const pagePath = getBShellPagePath(item.page_key)
      if (!pagePath) {
        return null
      }

      return Object.assign({}, item, {
        pagePath,
      })
    })
    .filter(Boolean)
}

module.exports = {
  BSHELL_HOME,
  BSHELL_PAGE_PATHS,
  normalizePagePath,
  buildQueryString,
  buildPageUrl,
  getBShellPagePath,
  buildBShellPageUrl,
  resolveBShellTabItems,
}
