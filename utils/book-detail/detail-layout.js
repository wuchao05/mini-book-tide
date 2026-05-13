const {
  buildBShellPageUrl,
  getBShellPagePath,
  resolveBShellTabItems,
} = require('../shell-pages')

const LOCAL_TAB_BAR_ITEMS = {
  theater: {
    text: '剧场',
    icon: '/assets/book-detail/tabs/juchang.png',
    active_icon: '/assets/book-detail/tabs/juchang-active.png',
  },
  follow: {
    text: '追剧',
    icon: '/assets/book-detail/tabs/zhuiju.png',
    active_icon: '/assets/book-detail/tabs/zhuiju-active.png',
  },
  mine: {
    text: '我的',
    icon: '/assets/book-detail/tabs/wode.png',
    active_icon: '/assets/book-detail/tabs/wode-active.png',
  },
}

const LOCAL_TAB_BAR_ITEMS_FALLBACK = [
  {
    page_key: 'follow',
    text: LOCAL_TAB_BAR_ITEMS.follow.text,
    icon: LOCAL_TAB_BAR_ITEMS.follow.icon,
    active_icon: LOCAL_TAB_BAR_ITEMS.follow.active_icon,
    pagePath: '/pages/book-detail/follow/index',
  },
  {
    page_key: 'theater',
    text: LOCAL_TAB_BAR_ITEMS.theater.text,
    icon: LOCAL_TAB_BAR_ITEMS.theater.icon,
    active_icon: LOCAL_TAB_BAR_ITEMS.theater.active_icon,
    pagePath: '/pages/book-detail/theater/index',
  },
  {
    page_key: 'mine',
    text: LOCAL_TAB_BAR_ITEMS.mine.text,
    icon: LOCAL_TAB_BAR_ITEMS.mine.icon,
    active_icon: LOCAL_TAB_BAR_ITEMS.mine.active_icon,
    pagePath: '/pages/book-detail/mine/index',
  },
]

const LOCAL_BOOTSTRAP_ASSETS = {
  common_arrow_icon: '/assets/book-detail/s_menu.png',
  common_close_icon: '/assets/book-detail/s_close.png',
  default_avatar: '/assets/book-detail/s_def_avatar.png',
  default_empty_icon: '/assets/book-detail/empty.png',
}

const LOCAL_THEME = {
  page_bg_color: '#f8f8fa',
  card_bg_color: '#ffffff',
  primary_color: '#3ccfcf',
  secondary_color: '#2ebaba',
  text_primary: '#121620',
  text_secondary: '#696d78',
}

const LOCAL_PAGE_BACKGROUNDS = {
  theater: '#ffffff',
  follow: '#ffffff',
  mine: '#f8f8fa',
}

const LOCAL_PAYMENT_THEME_ASSETS = {
  gold: {
    popup_bg: '/assets/book-detail/pay_dialog/theme_gold/gold-bg.png',
    normal_card_bg: '/assets/book-detail/pay_dialog/theme_gold/gold-normal.png',
    highlight_card_bg: '/assets/book-detail/pay_dialog/theme_gold/gold-highlight.png',
    header_icon: '',
  },
  pink: {
    popup_bg: '/assets/book-detail/pay_dialog/theme_pink/theme-pink-bg.png',
    normal_card_bg: '/assets/book-detail/pay_dialog/theme_pink/normal-sku-bg.png',
    highlight_card_bg: '/assets/book-detail/pay_dialog/theme_pink/highlight-sku-bg.png',
    header_icon: '/assets/book-detail/pay_dialog/theme_pink/header-icon.png',
  },
}

function cloneConfig(value) {
  if (!value || typeof value !== 'object') {
    return value || {}
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    console.warn('复制动态壳配置失败，改为浅拷贝处理', error)
    return Array.isArray(value) ? value.slice() : Object.assign({}, value)
  }
}

function fillWhenEmpty(target, key, fallbackValue) {
  if (!target || !key) {
    return
  }

  const currentValue = target[key]
  if (currentValue === undefined || currentValue === null || currentValue === '') {
    target[key] = fallbackValue
  }
}

function setLocalAsset(target, key, localValue) {
  if (!target || !key) {
    return
  }

  target[key] = localValue
}

function setLocalBackground(pageConfig, color) {
  if (!pageConfig || !color) {
    return
  }

  pageConfig.background = Object.assign({}, pageConfig.background, {
    type: 'color',
    value: color,
  })
}

function ensureSection(pageConfig, key, type) {
  const sections = (pageConfig && pageConfig.sections) || []

  return (
    sections.find((item) => {
      if (!item || item.visible === false) {
        return false
      }

      if (key && item.key === key) {
        return true
      }

      return !!type && item.type === type
    }) || null
  )
}

function normalizeTabBarConfig(tabBarConfig) {
  const normalized = cloneConfig(tabBarConfig) || {}
  const rawItems = Array.isArray(normalized.items) ? normalized.items : []

  normalized.items = rawItems
    .map((item) => {
      if (!item) {
        return null
      }

      const localItem = LOCAL_TAB_BAR_ITEMS[item.page_key] || {}
      const nextItem = Object.assign({}, item)
      fillWhenEmpty(nextItem, 'text', localItem.text || '')
      setLocalAsset(nextItem, 'icon', localItem.icon || '')
      setLocalAsset(nextItem, 'active_icon', localItem.active_icon || '')
      return nextItem
    })
    .filter(Boolean)

  if (!normalized.default_page_key) {
    normalized.default_page_key = 'theater'
  }

  return normalized
}

function resolveMenuFallbackIcon(item) {
  const action = (item && item.action) || {}
  const params = action.params || {}

  if (action.type === 'contact') {
    return '/assets/book-detail/s_icon_customer.png'
  }

  if (action.type === 'favorite_tip') {
    return '/assets/book-detail/s_icon_collection.png'
  }

  if (params.page_key === 'recharge_record') {
    return '/assets/book-detail/s_icon_pay.png'
  }

  if (params.page_key === 'consume_record') {
    return '/assets/book-detail/s_icon_consume_new.png'
  }

  return ''
}

function isUnavailableNavigateMenuItem(item) {
  const action = (item && item.action) || {}
  const params = action.params || {}
  return action.type === 'navigate_page' && !getBShellPagePath(params.page_key)
}

function normalizeTheaterPage(pageConfig) {
  if (!pageConfig || typeof pageConfig !== 'object') {
    return pageConfig || {}
  }

  const nextPageConfig = pageConfig
  setLocalBackground(nextPageConfig, LOCAL_PAGE_BACKGROUNDS.theater)
  nextPageConfig.nav_bar = Object.assign({}, nextPageConfig.nav_bar)

  const hotSection = ensureSection(nextPageConfig, 'hot', 'hot_swiper')
  const goodSection = ensureSection(nextPageConfig, 'selected_list', 'grid_list')
  const yearSection = ensureSection(nextPageConfig, 'year_list', 'grid_list')

  if (hotSection) {
    setLocalAsset(hotSection, 'title_icon', '/assets/book-detail/title_icon.png')
  }

  if (goodSection) {
    setLocalAsset(goodSection, 'title_icon', '/assets/book-detail/rank_top.png')
  }

  if (yearSection) {
    setLocalAsset(yearSection, 'title_icon', '/assets/book-detail/rank_top.png')
  }

  nextPageConfig.floating = Object.assign({}, nextPageConfig.floating)
  nextPageConfig.floating.resume_card = Object.assign({}, nextPageConfig.floating.resume_card)
  setLocalAsset(
    nextPageConfig.floating.resume_card,
    'play_icon',
    '/assets/book-detail/revenue_play_btn.png',
  )

  nextPageConfig.dialogs = Object.assign({}, nextPageConfig.dialogs)
  nextPageConfig.dialogs.revenue_dialog = Object.assign({}, nextPageConfig.dialogs.revenue_dialog)
  setLocalAsset(
    nextPageConfig.dialogs.revenue_dialog,
    'bg_image',
    '/assets/book-detail/revenue_bg.png',
  )
  setLocalAsset(
    nextPageConfig.dialogs.revenue_dialog,
    'close_icon',
    '/assets/book-detail/free_dialog/close_icon.png',
  )
  setLocalAsset(
    nextPageConfig.dialogs.revenue_dialog,
    'enter_button_image',
    '/assets/book-detail/revenue_enter_btn.png',
  )
  setLocalAsset(
    nextPageConfig.dialogs.revenue_dialog,
    'play_button_image',
    '/assets/book-detail/revenue_play_btn.png',
  )

  return nextPageConfig
}

function normalizeFollowPage(pageConfig) {
  if (!pageConfig || typeof pageConfig !== 'object') {
    return pageConfig || {}
  }

  const nextPageConfig = pageConfig
  setLocalBackground(nextPageConfig, LOCAL_PAGE_BACKGROUNDS.follow)
  nextPageConfig.nav_bar = Object.assign({}, nextPageConfig.nav_bar)
  nextPageConfig.nav_bar.items = ((nextPageConfig.nav_bar && nextPageConfig.nav_bar.items) || []).map(
    (item, index) => {
      const nextItem = Object.assign({}, item)
      return nextItem
    },
  )

  nextPageConfig.empty_state = Object.assign({}, nextPageConfig.empty_state)
  setLocalAsset(nextPageConfig.empty_state, 'icon', '/assets/book-detail/empty.png')

  nextPageConfig.list_config = Object.assign({}, nextPageConfig.list_config)
  setLocalAsset(nextPageConfig.list_config, 'progress_icon', '/assets/book-detail/s_pay.png')

  return nextPageConfig
}

function normalizeMinePage(pageConfig) {
  if (!pageConfig || typeof pageConfig !== 'object') {
    return pageConfig || {}
  }

  const nextPageConfig = pageConfig
  setLocalBackground(nextPageConfig, LOCAL_PAGE_BACKGROUNDS.mine)
  nextPageConfig.header = Object.assign({}, nextPageConfig.header)
  setLocalAsset(nextPageConfig.header, 'bg_image', '/assets/book-detail/back.png')
  setLocalAsset(nextPageConfig.header, 'default_avatar', '/assets/book-detail/s_def_avatar.png')

  nextPageConfig.account_cards = ((nextPageConfig.account_cards || []).map((item, index) => {
    const nextItem = Object.assign({}, item)
    if (index === 0) {
      setLocalAsset(nextItem, 'icon', '/assets/book-detail/s_account.png')
      setLocalAsset(nextItem, 'action_icon', '/assets/book-detail/s_go_pay.png')
    }
    if (index === 1) {
      setLocalAsset(nextItem, 'icon', '/assets/book-detail/s_vip.png')
    }
    return nextItem
  }))

  nextPageConfig.menus = ((nextPageConfig.menus || [])
    .filter((item) => !isUnavailableNavigateMenuItem(item))
    .map((item) => {
      const nextItem = Object.assign({}, item)
      setLocalAsset(nextItem, 'icon', resolveMenuFallbackIcon(nextItem))
      return nextItem
    }))

  return nextPageConfig
}

function normalizeAuxPageConfig(pageKey, pageConfig) {
  const nextPageConfig = cloneConfig(pageConfig) || {}

  if (pageKey === 'recharge_record' || pageKey === 'consume_record') {
    setLocalBackground(nextPageConfig, '#f8f8fa')
    setLocalAsset(nextPageConfig, 'customer_icon', '/assets/book-detail/s_icon_customer.png')
  }

  if (pageKey === 'payment_popup') {
    setLocalAsset(nextPageConfig, 'close_icon', '/assets/book-detail/s_close.png')
    setLocalAsset(nextPageConfig, 'customer_icon', '/assets/book-detail/s_icon_customer.png')
    setLocalAsset(nextPageConfig, 'gesture_icon', '/assets/book-detail/pay_dialog/isGesture.png')

    nextPageConfig.themes = Object.assign({}, nextPageConfig.themes)
    Object.keys(LOCAL_PAYMENT_THEME_ASSETS).forEach((themeKey) => {
      nextPageConfig.themes[themeKey] = Object.assign(
        {},
        nextPageConfig.themes[themeKey],
        LOCAL_PAYMENT_THEME_ASSETS[themeKey],
      )
    })
  }

  return nextPageConfig
}

function normalizeGlobalAssets(globalAssets) {
  return Object.assign({}, globalAssets, {
    empty_icon: '/assets/book-detail/empty.png',
    title_icon: '/assets/book-detail/title_icon.png',
  })
}

function normalizePageConfig(pageKey, pageConfig) {
  const nextPageConfig = cloneConfig(pageConfig) || {}

  if (pageKey === 'theater') {
    return normalizeTheaterPage(nextPageConfig)
  }

  if (pageKey === 'follow') {
    return normalizeFollowPage(nextPageConfig)
  }

  if (pageKey === 'mine') {
    return normalizeMinePage(nextPageConfig)
  }

  return nextPageConfig
}

function normalizeBootstrapConfig(config) {
  const normalized = cloneConfig(config) || {}
  normalized.assets = Object.assign({}, normalized.assets, LOCAL_BOOTSTRAP_ASSETS)
  normalized.theme = Object.assign({}, normalized.theme, LOCAL_THEME)
  normalized.tab_bar = normalizeTabBarConfig(normalized.tab_bar)
  return normalized
}

function normalizeLayoutConfig(layout) {
  const normalized = cloneConfig(layout) || {}
  const pages = normalized.pages || {}
  const auxPages = normalized.aux_pages || {}
  normalized.global_assets = normalizeGlobalAssets(normalized.global_assets)

  normalized.pages = Object.keys(pages).reduce((result, pageKey) => {
    result[pageKey] = normalizePageConfig(pageKey, pages[pageKey])
    return result
  }, {})

  normalized.aux_pages = Object.keys(auxPages).reduce((result, pageKey) => {
    result[pageKey] = normalizeAuxPageConfig(pageKey, auxPages[pageKey])
    return result
  }, {})

  return normalized
}

function getBootstrapConfig() {
  const app = getApp()
  const config = app && app.getMiniAppShellConfig ? app.getMiniAppShellConfig() || {} : {}
  return normalizeBootstrapConfig(config)
}

function getLayoutConfig() {
  const app = getApp()
  const layout = app && app.getBShellLayout ? app.getBShellLayout() || {} : {}
  return normalizeLayoutConfig(layout)
}

async function ensureLayoutConfig(options = {}) {
  const app = getApp()
  if (!app || typeof app.ensureBShellLayout !== 'function') {
    return getLayoutConfig()
  }

  return normalizeLayoutConfig((await app.ensureBShellLayout(options)) || {})
}

function getThemeConfig() {
  return getBootstrapConfig().theme || {}
}

function getAssetsConfig() {
  return getBootstrapConfig().assets || {}
}

function getTabBarConfig() {
  return getBootstrapConfig().tab_bar || { items: [] }
}

function isBShellMode() {
  const config = getBootstrapConfig()
  const apiMode = (config && config.mode) || ''
  return apiMode === 'B'
}

function getDefaultTabBarItems() {
  return LOCAL_TAB_BAR_ITEMS_FALLBACK
}

function getResolvedTabBarItems() {
  if (!isBShellMode()) {
    return LOCAL_TAB_BAR_ITEMS_FALLBACK
  }
  return resolveBShellTabItems(getTabBarConfig())
}

function getPageConfig(pageKey) {
  const layout = getLayoutConfig()
  return (layout.pages && layout.pages[pageKey]) || {}
}

function getAuxPageConfig(pageKey) {
  const layout = getLayoutConfig()
  return (layout.aux_pages && layout.aux_pages[pageKey]) || {}
}

function findSection(pageConfig, key, type) {
  return ensureSection(pageConfig, key, type)
}

function getActionPageUrl(action) {
  const params = (action && action.params) || {}
  const pageKey = params.page_key || ''

  if (!pageKey) {
    return ''
  }

  return buildBShellPageUrl(pageKey)
}

function readMappedField(source, fieldName, fallback) {
  if (!fieldName) {
    return fallback
  }

  const fieldPath = String(fieldName).split('.')
  let current = source

  for (let index = 0; index < fieldPath.length; index += 1) {
    if (current === null || current === undefined) {
      return fallback
    }
    current = current[fieldPath[index]]
  }

  return current === undefined || current === null || current === '' ? fallback : current
}

function buildStandardDramaItem(item, itemSchema = {}) {
  return {
    id: Number(readMappedField(item, itemSchema.id_field || 'id', 0)) || 0,
    cover: readMappedField(item, itemSchema.cover || 'cover', ''),
    title: readMappedField(item, itemSchema.title || 'title', ''),
    update_text: readMappedField(item, itemSchema.sub_title || 'update_text', ''),
    actionText: readMappedField(item, itemSchema.action_text || '', '') || itemSchema.action_text || '',
  }
}

function buildStandardDramaGroups(list, groupSchema = {}, itemSchema = {}) {
  return (list || []).map((group) => ({
    title: readMappedField(group, groupSchema.title || 'title', ''),
    list: (readMappedField(group, groupSchema.list || 'list', []) || []).map((item) =>
      buildStandardDramaItem(item, itemSchema),
    ),
  }))
}

function buildMenuList(menuConfig, options = {}) {
  const isDevEnv = !!options.isDevEnv
  return (menuConfig || []).filter((item) => !item.isDevOnly || isDevEnv)
}

module.exports = {
  isBShellMode,
  ensureLayoutConfig,
  getBootstrapConfig,
  getLayoutConfig,
  getThemeConfig,
  getAssetsConfig,
  getTabBarConfig,
  getResolvedTabBarItems,
  getDefaultTabBarItems,
  getPageConfig,
  getAuxPageConfig,
  findSection,
  getActionPageUrl,
  readMappedField,
  buildStandardDramaItem,
  buildStandardDramaGroups,
  buildMenuList,
  getBShellPagePath,
}
