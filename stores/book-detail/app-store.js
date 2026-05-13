const listeners = new Set()

const DEFAULT_CONFIG = {
  adUnitId: '',
  imId: '',
  isFree: false,
  isMixPayTpl: '',
  iaaAdCountDown: 10,
  iaaAdAutoPlay: 1,
  closeIosPayApp: 0,
  mixPayUnlockNum: 0,
  payFreeWatchDuration: 10,
  forceRevenue: 0,
  iosPaymentSupport: false,
  iaaNewReward: {
    iaa_new_reward_popup_text: '',
    iaa_new_reward_swt: 0,
    iaa_new_reward_tpl_code: 0,
    iaa_new_reward_unlock_episodes: 0,
  },
  defaultAlbumId: 0,
  isSendErrorMsg: false,
  homePopupAdSwt: 0,
  ipuThreshold: 0,
  enableEmbedPayment: false,
}

const state = {
  token: '',
  appIdentifier: '',
  appid: '',
  appName: '',
  enableH5Page: true,
  pendingTheaterTab: null,
  h5FeedCache: {
    ready: false,
    page: 1,
    pageSize: 10,
    app: '',
    list: [],
  },
  isFromImSuccess: false,
  config: Object.assign({}, DEFAULT_CONFIG),
  isShowGuideEntry: false,
  showNewUser: false,
  nextTimeUnlockNum: 0,
  currentData: {},
  isPaying: false,
  isFirstLaunch: true,
  isNewUser: false,
  configReady: false,
  ipuCount: 0,
}

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener(state)
    } catch (error) {
      console.error('app-store listener error', error)
    }
  })
}

function subscribe(listener) {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

function update(patch) {
  Object.assign(state, patch)
  emitChange()
}

function updateConfig(configPatch) {
  Object.assign(state.config, configPatch)
  emitChange()
}

function setToken(token) {
  state.token = token || ''
  if (state.token) {
    wx.setStorageSync('token', state.token)
  } else {
    wx.removeStorageSync('token')
  }
  emitChange()
}

function clearToken() {
  setToken('')
}

async function initApp(identifiers) {
  if (identifiers) {
    state.appid = identifiers.appid || state.appid
    state.appIdentifier = identifiers.app || state.appIdentifier
    state.appName = identifiers.name || state.appName
  }
  const savedToken = wx.getStorageSync('token')
  if (savedToken && !state.token) {
    state.token = savedToken
  }

  const CommonApi = require('../../services/book-detail/api/common')
  const appConfig = await CommonApi.getAppConfig()
  if (appConfig.code === 0 && appConfig.data) {
    const data = appConfig.data
    updateConfig({
      adUnitId: data.ad_id || '',
      imId: data.dy_kefu || '',
      isFree: !!data.is_free_app,
      iaaAdCountDown: data.iaa_ad_count_down == null ? 10 : data.iaa_ad_count_down,
      iaaAdAutoPlay: data.iaa_ad_auto_play == null ? 1 : data.iaa_ad_auto_play,
      closeIosPayApp: data.close_ios_pay_app == null ? 0 : data.close_ios_pay_app,
      mixPayUnlockNum: data.mix_pay_unlock_num == null ? 0 : data.mix_pay_unlock_num,
      payFreeWatchDuration:
        data.pay_free_watch_duration == null ? 10 : data.pay_free_watch_duration,
      forceRevenue: data.force_revenue == null ? 0 : data.force_revenue,
      iaaNewReward: {
        iaa_new_reward_popup_text:
          data.iaa_new_reward && data.iaa_new_reward.iaa_new_reward_popup_text
            ? data.iaa_new_reward.iaa_new_reward_popup_text
            : '',
        iaa_new_reward_swt:
          data.iaa_new_reward && data.iaa_new_reward.iaa_new_reward_swt
            ? data.iaa_new_reward.iaa_new_reward_swt
            : 0,
        iaa_new_reward_tpl_code:
          data.iaa_new_reward && data.iaa_new_reward.iaa_new_reward_tpl_code
            ? data.iaa_new_reward.iaa_new_reward_tpl_code
            : 0,
        iaa_new_reward_unlock_episodes:
          data.iaa_new_reward && data.iaa_new_reward.iaa_new_reward_unlock_episodes
            ? data.iaa_new_reward.iaa_new_reward_unlock_episodes
            : 0,
      },
      defaultAlbumId:
        data.default_album_info && data.default_album_info.album_id
          ? data.default_album_info.album_id
          : 0,
      isSendErrorMsg: !!data.is_send_error_msg,
      homePopupAdSwt: data.home_popup_ad_swt == null ? 0 : data.home_popup_ad_swt,
      ipuThreshold: data.ipu_threshold == null ? 0 : data.ipu_threshold,
      enableEmbedPayment: Number(data.enable_embed_payment || 0) === 1,
    })
    state.configReady = true
    emitChange()
  }
  return state.config
}

module.exports = {
  state,
  subscribe,
  update,
  updateConfig,
  setToken,
  clearToken,
  initApp,
}
