const ASHELL_HOME = '/pages/home/index'
const BSHELL_HOME = '/pages/book-detail/theater/index'
const { createPage } = require('../../utils/page')
const { STORAGE_KEYS } = require('../../constants')
const { getStorage, setStorage } = require('../../utils/storage')
const {
  buildBShellPageUrl,
  buildPageUrl,
  isDirectBShellPath,
  normalizePagePath,
} = require('../../utils/shell-pages')

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

function buildTargetQuery(options) {
  const query = Object.assign({}, options || {})

  delete query.target_path
  delete query.target_query

  return query
}

function buildTargetUrl(path, query) {
  const finalQuery = Object.assign({}, query, {
    __from_launcher: 1,
  })
  return buildPageUrl(path, finalQuery) || BSHELL_HOME
}

function shouldResumeBShellSession(app, targetPath) {
  return !!(app && app.hasActiveBShellSession && app.hasActiveBShellSession() && !targetPath)
}

function openResolvedBShellTarget(app, targetPath, entryQuery, shellConfig) {
  const resolvedTargetPath = isDirectBShellPath(targetPath) ? normalizePagePath(targetPath) : ''
  const defaultPageKey =
    (shellConfig && shellConfig.tab_bar && shellConfig.tab_bar.default_page_key) || 'theater'
  const fallbackUrl = buildBShellPageUrl(defaultPageKey, entryQuery) || BSHELL_HOME

  app.setCurrentMode('bshell')
  app.setLaunchOptions({
    path: (resolvedTargetPath || fallbackUrl).replace(/^\//, ''),
    query: entryQuery,
  })

  wx.reLaunch({
    url: resolvedTargetPath ? buildTargetUrl(resolvedTargetPath, entryQuery) : fallbackUrl,
  })
}

function openCachedBShellHome(app, shellConfig) {
  const defaultPageKey =
    (shellConfig && shellConfig.tab_bar && shellConfig.tab_bar.default_page_key) || 'theater'
  const nextUrl = buildBShellPageUrl(defaultPageKey) || BSHELL_HOME

  app.setCurrentMode('bshell')
  app.setLaunchOptions({
    path: nextUrl.replace(/^\//, ''),
    query: {},
  })

  wx.reLaunch({
    url: nextUrl,
  })
}

function openAShellEntry(app, query) {
  app.setCurrentMode('ashell')
  app.setLaunchOptions({
    path: ASHELL_HOME.replace(/^\//, ''),
    query: query || {},
  })

  wx.switchTab({
    url: ASHELL_HOME,
    fail() {
      wx.reLaunch({
        url: ASHELL_HOME,
      })
    },
  })
}

createPage({
  async onLoad(options) {
    await this.redirectByMode(options)
  },

  async redirectByMode(options) {
    const app = getApp()
    const query = options || {}
    const targetPath = query.target_path || ''
    const fallbackQuery = buildTargetQuery(query)
    const targetQuery = query.target_query ? parseTargetQuery(query.target_query) : fallbackQuery
    const entryPath = normalizePagePath(targetPath)
    const entryQuery = targetPath ? Object.assign({}, fallbackQuery, targetQuery) : fallbackQuery
    const cachedMode = getStorage(STORAGE_KEYS.SHELL_MODE, '')
    const shellResult = app.fetchMiniAppShellConfigWithRetry
      ? await app.fetchMiniAppShellConfigWithRetry(1)
      : {
          success: false,
          data: null,
        }
    const shellConfig =
      shellResult.data || (app.getMiniAppShellConfig && app.getMiniAppShellConfig()) || null
    const apiMode = (shellConfig && shellConfig.mode) || ''
    const effectiveMode = apiMode || cachedMode

    if (apiMode) {
      setStorage(STORAGE_KEYS.SHELL_MODE, apiMode)
    }

    if (effectiveMode === 'B') {
      await (app.ensureBShellLayout ? app.ensureBShellLayout() : Promise.resolve())

      if (shouldResumeBShellSession(app, targetPath)) {
        openCachedBShellHome(app, shellConfig)
        return
      }

      openResolvedBShellTarget(app, entryPath, entryQuery, shellConfig)
      return
    }

    openAShellEntry(app, fallbackQuery)
  },
})
