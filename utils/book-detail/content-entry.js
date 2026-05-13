const appStore = require('../../stores/book-detail/app-store')
const { buildBShellPageUrl } = require('../shell-pages')

function buildForecastUrl(albumId, options = {}) {
  const episodeIndex = resolveEpisodeIndex(options)

  return buildBShellPageUrl('forecast', {
    album_id: Number(albumId || 0),
    episode_index: episodeIndex,
  })
}

function resolveEpisodeIndex(options) {
  if (typeof options === 'number') {
    return Number.isFinite(options) ? options : 0
  }

  if (!options || typeof options !== 'object') {
    return 0
  }

  const rawEpisodeIndex =
    options.episode_index !== undefined ? options.episode_index : options.episodeIndex
  const episodeIndex = Number(rawEpisodeIndex)

  return Number.isFinite(episodeIndex) ? episodeIndex : 0
}

function showCannotPlayToast() {
    wx.showToast({
      title: '当前内容暂时无法查看',
      icon: 'none',
    })
}

function openAlbum(albumId, options = {}) {
  return openAlbumNative(albumId, options)
}

function openAlbumNative(albumId, options = {}) {

  if (!albumId) {
    return
  }

  const normalizedOptions =
    typeof options === 'object' && options !== null
      ? options
      : {
          episode_index: options,
        }
  const targetUrl = buildForecastUrl(albumId, normalizedOptions)

  appStore.update({
    currentData: Object.assign({}, appStore.state.currentData, {
      id: Number(albumId),
    }),
  })

  if (normalizedOptions.replaceCurrent) {
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    if (currentPage && currentPage.route === 'pages/book-detail/forecast/index') {
      wx.redirectTo({
        url: targetUrl,
      })
      return
    }
  }

  wx.navigateTo({
    url: targetUrl,
  })
}

module.exports = {
  openAlbum,
  openAlbumNative,
  buildForecastUrl,
  showCannotPlayToast,
}
