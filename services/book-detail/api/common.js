const request = require('../request')
const appStore = require('../../../stores/book-detail/app-store')

function getAppConfig() {
  return request({
    url: '/config',
    method: 'GET',
  })
}

function markPremiumUser(params) {
  return request({
    url: '/play/markPremium',
    method: 'POST',
    data: params,
  })
}

function getSkuList(params) {
  return request({
    url: '/pay/getSkuList',
    method: 'GET',
    data: params,
  })
}

function getPopSkuInfo(albumId) {
  return request({
    url: '/pop/getPop',
    method: 'GET',
    data: {
      pop_id: 'iaa_click_unlock_album',
      platform: getSystemPlatform(),
      account_index: appStore.state.accountIndex,
      album_id: albumId || '',
    },
  })
}

function unlock(params) {
  return request({
    url: '/pay/unlock',
    method: 'POST',
    data: params,
  })
}

function getEpisodeList(albumId) {
  return request({
    url: '/play/episodeList',
    method: 'GET',
    data: {
      album_id: albumId,
    },
  })
}

function getEpisodeDetail(albumId) {
  return request({
    url: '/play/album/detail',
    method: 'GET',
    data: {
      album_id: albumId,
    },
  })
}

function getRechargeInfo(albumId) {
  return request({
    url: '/pay/getSkuList',
    method: 'GET',
    data: {
      album_id: albumId,
    },
  })
}

function getOrderInfo(outOrderNo) {
  return request({
    url: '/pay/getOrderInfo',
    method: 'GET',
    data: {
      out_order_no: outOrderNo,
    },
  })
}

function getBanner() {
  return request({
    url: '/play/bannerList',
    method: 'GET',
    data: {
      web: 1,
      platform: getSystemPlatform(),
    },
  })
}

function getHotList() {
  return request({
    url: '/play/page/hotList',
    method: 'GET',
  })
}

function getAllList(data) {
  return request({
    url: '/play/page/allList',
    method: 'GET',
    data: data || { page: 1, page_size: 10 },
  })
}

function getH5List(data) {
  return request({
    url: '/play/h5/page/feedList',
    method: 'GET',
    data: data || { page: 1, page_size: 10 },
  })
}

function errorReport(data) {
  return request({
    url: '/error/report',
    method: 'POST',
    data,
  })
}

function collection(albumId) {
  return request({
    url: '/play/album/collection',
    method: 'POST',
    data: {
      album_id: albumId,
    },
  })
}

function cancelCollection(albumId) {
  return request({
    url: '/play/album/cancel',
    method: 'POST',
    data: {
      album_id: albumId,
    },
  })
}

function like(albumId, episodeId) {
  return request({
    url: '/play/episode/like',
    method: 'POST',
    data: {
      album_id: albumId,
      episode_id: episodeId,
    },
  })
}

function cancelLike(albumId, episodeId) {
  return request({
    url: '/play/episode/cancel',
    method: 'POST',
    data: {
      album_id: albumId,
      episode_id: episodeId,
    },
  })
}

function reportHistory(albumId, episodeId) {
  return request({
    url: '/play/history/report',
    method: 'POST',
    data: {
      album_id: albumId,
      episode_id: episodeId,
    },
  })
}

function login(data) {
  return request({
    url: '/user/login',
    method: 'POST',
    data,
  })
}

function getUserInfo() {
  return request({
    url: '/user/info',
    method: 'GET',
  })
}

function getRechargeRecord(data) {
  return request({
    url: '/pay/getRechargeList',
    method: 'GET',
    data: data || { page: 1, page_size: 10 },
  })
}

function getConsumeRecord(data) {
  return request({
    url: '/pay/getConsumeList',
    method: 'GET',
    data: data || { page: 1, page_size: 10 },
  })
}

function getCollectionList(data) {
  return request({
    url: '/play/collectionList',
    method: 'GET',
    data,
  })
}

function getHistoryList(data) {
  return request({
    url: '/play/historyList',
    method: 'GET',
    data,
  })
}

function reportClick(data) {
  return request({
    url: '/click/report',
    method: 'GET',
    data,
  })
}

function getSystemPlatform() {
  const systemInfo = wx.getSystemInfoSync()
  const platform = String(systemInfo.platform || '').toLowerCase()
  if (platform === 'ios') {
    return 'ios'
  }
  if (platform === 'android') {
    return 'android'
  }
  return 'unknown'
}

module.exports = {
  getAppConfig,
  markPremiumUser,
  getSkuList,
  getPopSkuInfo,
  unlock,
  getEpisodeList,
  getEpisodeDetail,
  getRechargeInfo,
  getOrderInfo,
  getBanner,
  getHotList,
  getAllList,
  getH5List,
  errorReport,
  collection,
  cancelCollection,
  like,
  cancelLike,
  reportHistory,
  login,
  getUserInfo,
  getRechargeRecord,
  getConsumeRecord,
  getCollectionList,
  getHistoryList,
  reportClick,
}
