const appStore = require('../../../stores/book-detail/app-store')
const CommonApi = require('../../../services/book-detail/api/common')
const splayRuntime = require('../../../runtime/book-detail/app-runtime')
const { createBShellPage } = require('../../../utils/book-detail/launch-access')
const embeddedPayment = require('../../../utils/book-detail/embedded-payment')
const enums = require('../../../config/book-detail/enums')

const THEATER_RESUME_FLOAT_STORAGE_KEY = 'splay_theater_resume_float_enabled'

createBShellPage({
  data: {
    albumId: 0,
    albumTitle: '',
    episodeList: [],
    episodeDetail: null,
    userInfo: null,
    rechargeInfo: null,
    swipeIndex: 0,
    showMask: false,
    showRefillModal: false,
    showEpisodeDetail: false,
    loaded: false,
    showWhiteScreen: false,
    isUnlocking: false,
    isEpisodeChanging: false,
  },

  async onLoad(options) {
    await splayRuntime.ensureStarted()

    const albumId = Number(options.album_id || 0)
    if (!albumId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack()
      } else {
        wx.reLaunch({
          url: '/pages/book-detail/theater/index',
        })
      }
      return
    }

    appStore.update({
      currentData: Object.assign({}, appStore.state.currentData, {
        id: albumId,
      }),
    })

    this.setData({
      albumId,
      swipeIndex: Number(options.episode_index || 0),
    })

    this.setupCaptureProtection()
    await this.loadPageData()
  },

  async onShow() {
    await this.consumeEmbeddedPaymentResult()
  },

  onHide() {
    this.pauseCurrentVideo()
    if (this.data.isEpisodeChanging) {
      this.setData({
        isEpisodeChanging: false,
      })
    }
  },

  onUnload() {
    this.pauseCurrentVideo()
    this.clearCaptureProtection()
    this.enableTheaterResumeFloat()
  },

  enableTheaterResumeFloat() {
    try {
      wx.setStorageSync(THEATER_RESUME_FLOAT_STORAGE_KEY, 1)
    } catch (error) {
      console.warn('记录剧场续看浮框状态失败', error)
    }
  },

  setupCaptureProtection() {
    try {
      if (typeof wx.setVisualEffectOnCapture === 'function') {
        wx.setVisualEffectOnCapture({
          visualEffect: 'hidden',
        })
      }
    } catch (error) {
      console.warn('开启防截屏失败', error)
    }

    if (typeof wx.onUserCaptureScreen !== 'function') {
      return
    }

    this._captureScreenHandler = () => {
      this.setData({
        showWhiteScreen: true,
      })
      clearTimeout(this._whiteScreenTimer)
      this._whiteScreenTimer = setTimeout(() => {
        this.setData({
          showWhiteScreen: false,
        })
      }, 1500)
    }

    wx.onUserCaptureScreen(this._captureScreenHandler)
  },

  clearCaptureProtection() {
    clearTimeout(this._whiteScreenTimer)

    try {
      if (typeof wx.setVisualEffectOnCapture === 'function') {
        wx.setVisualEffectOnCapture({
          visualEffect: 'none',
        })
      }
    } catch (error) {
      console.warn('关闭防截屏失败', error)
    }

    try {
      if (typeof wx.offUserCaptureScreen === 'function' && this._captureScreenHandler) {
        wx.offUserCaptureScreen(this._captureScreenHandler)
      }
    } catch (error) {
      console.warn('移除截屏监听失败', error)
    }

    this._captureScreenHandler = null
  },

  noop() {},

  async loadPageData() {
    wx.showLoading({ title: '加载中...', mask: true })

    try {
      await Promise.all([
        this.fetchEpisodeList(),
        this.fetchEpisodeDetail(),
        this.fetchUserInfo(),
        this.fetchRechargeInfo(),
      ])

      this.normalizeSwipeIndex()
      this.syncCurrentEpisodeState()
      this.reportCurrentHistory()

      this.setData({
        loaded: true,
      })
    } catch (error) {
      console.error('播放器页面加载失败', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  async fetchEpisodeList() {
    const response = await CommonApi.getEpisodeList(this.data.albumId)
    if (response.code === 0 && Array.isArray(response.data)) {
      this.setData({
        episodeList: response.data,
      })
    }
    return response
  },

  async fetchEpisodeDetail() {
    const response = await CommonApi.getEpisodeDetail(this.data.albumId)
    if (response.code === 0 && response.data) {
      this.setData({
        episodeDetail: response.data,
        albumTitle: response.data.title || '',
      })
    }
    return response
  },

  async fetchUserInfo() {
    const response = await CommonApi.getUserInfo()
    if (response.code === 0 && response.data) {
      this.setData({
        userInfo: response.data,
      })
    }
    return response
  },

  async fetchRechargeInfo() {
    const response = await CommonApi.getRechargeInfo(this.data.albumId)
    if (response.code === 0 && response.data) {
      this.setData({
        rechargeInfo: response.data,
      })
    }
    return response
  },

  normalizeSwipeIndex() {
    const list = this.data.episodeList || []
    if (!list.length) {
      return
    }
    const maxIndex = list.length - 1
    const nextIndex = Math.min(Math.max(Number(this.data.swipeIndex || 0), 0), maxIndex)
    if (nextIndex !== this.data.swipeIndex) {
      this.setData({
        swipeIndex: nextIndex,
      })
    }
  },

  getCurrentEpisode(index) {
    const resolvedIndex = typeof index === 'number' ? index : this.data.swipeIndex
    return (this.data.episodeList || [])[resolvedIndex] || null
  },

  syncCurrentEpisodeState() {
    const episode = this.getCurrentEpisode()
    if (!episode) {
      this.setData({
        showMask: false,
        showRefillModal: false,
      })
      return
    }

    if (Number(episode.lock_status) === 0) {
      this.setData({
        showMask: false,
        showRefillModal: false,
      })
      return
    }

    this.setData({
      showMask: true,
      showRefillModal: false,
    })
  },

  reportCurrentHistory() {
    const episode = this.getCurrentEpisode()
    if (!episode || !episode.id) {
      return
    }
    CommonApi.reportHistory(this.data.albumId, episode.id).catch(() => {})
  },

  pauseCurrentVideo() {
    try {
      const radarPanel = this.selectComponent('#radarPanel')
      if (radarPanel && radarPanel.pause) {
        radarPanel.pause()
      }
    } catch (error) {
      console.warn('暂停视频失败', error)
    }
  },

  onEpisodeChange(event) {
    const { index } = event.detail
    const episode = this.getCurrentEpisode(index)
    if (!episode) {
      return
    }

    this.setData({
      swipeIndex: index,
      showEpisodeDetail: false,
    })

    CommonApi.reportHistory(this.data.albumId, episode.id).catch(() => {})

    if (Number(episode.lock_status) === 0) {
      this.setData({
        showMask: false,
        showRefillModal: false,
      })
      return
    }

    const userCoin = (this.data.userInfo && Number(this.data.userInfo.coin || 0)) || 0
    const episodePrice = Number(episode.price || 0)

    if (userCoin >= episodePrice) {
      this.autoUnlock(episode, index)
      return
    }

    this.setData({
      showMask: true,
      showRefillModal: true,
    })
  },

  onEpisodeEnded(event) {
    const currentIndex = Number(event.detail.index || 0)
    const nextIndex = currentIndex + 1
    if (nextIndex >= this.data.episodeList.length) {
      return
    }
    const radarPanel = this.selectComponent('#radarPanel')
    if (radarPanel && radarPanel.playEpisode) {
      radarPanel.playEpisode(nextIndex)
    }
  },

  onPlayError(event) {
    const { index } = event.detail
    setTimeout(() => {
      try {
        const radarPanel = this.selectComponent('#radarPanel')
        if (
          radarPanel &&
          radarPanel.getCurrentIndex &&
          radarPanel.getCurrentIndex() === index &&
          !radarPanel.getIsPlaying()
        ) {
          wx.showToast({
            title: '视频播放失败，请稍后重试',
            icon: 'none',
            duration: 2500,
          })
        }
      } catch (error) {
        console.warn('播放错误兜底提示失败', error)
      }
    }, 3000)
  },

  onMaskClick() {
    const episode = this.getCurrentEpisode()
    if (!episode) {
      return
    }

    const userCoin = (this.data.userInfo && Number(this.data.userInfo.coin || 0)) || 0
    const episodePrice = Number(episode.price || 0)

    if (userCoin < episodePrice) {
      this.setData({
        showRefillModal: true,
      })
      return
    }

    this.autoUnlock(episode, this.data.swipeIndex)
  },

  unlockEpisode(episodeId) {
    return CommonApi.unlock({
      album_id: this.data.albumId,
      episode_ids: String(episodeId),
      unlock_type: 'coin_new',
    })
  },

  async autoUnlock(episode, index) {
    if (!episode || this.data.isUnlocking) {
      return
    }

    this.setData({
      isUnlocking: true,
    })

    wx.showLoading({ title: '解锁中...', mask: true })

    try {
      const response = await this.unlockEpisode(episode.id)
      if (response.code !== 0) {
        wx.showToast({
          title: response.message || '解锁失败',
          icon: 'none',
        })
        return
      }

      await Promise.all([this.fetchEpisodeList(), this.fetchUserInfo()])

      this.setData({
        showMask: false,
        showRefillModal: false,
      })

      await Promise.resolve()

      const radarPanel = this.selectComponent('#radarPanel')
      if (radarPanel && radarPanel.playEpisode) {
        radarPanel.playEpisode(index)
      }
    } catch (error) {
      console.error('自动解锁失败', error)
      wx.showToast({
        title: '解锁失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
      this.setData({
        isUnlocking: false,
      })
    }
  },

  onRefillModalClose() {
    const episode = this.getCurrentEpisode()
    const shouldKeepMask = !!(episode && Number(episode.lock_status) !== 0)
    this.setData({
      showRefillModal: false,
      showMask: shouldKeepMask,
    })
  },

  async handlePaymentResult(status, episodeIndex) {
    const targetIndex = Number(episodeIndex === undefined ? this.data.swipeIndex : episodeIndex)

    if (status !== 'success' && status !== enums.PAY_STATUS.SUCCESS) {
      return
    }

    wx.showLoading({ title: '刷新中...', mask: true })

    try {
      await Promise.all([this.fetchUserInfo(), this.fetchEpisodeList()])

      const episode = this.getCurrentEpisode(targetIndex)
      const userCoin = (this.data.userInfo && Number(this.data.userInfo.coin || 0)) || 0
      const episodePrice = episode ? Number(episode.price || 0) : 0

      if (!episode) {
        return
      }

      if (Number(episode.lock_status) === 0) {
        this.setData({
          showMask: false,
          showRefillModal: false,
          swipeIndex: targetIndex,
        })
        return
      }

      if (userCoin < episodePrice) {
        this.setData({
          showRefillModal: false,
          showMask: true,
          swipeIndex: targetIndex,
        })
        wx.showToast({
          title: '余额不足，请选择更高额度充值',
          icon: 'none',
        })
        return
      }

      await this.autoUnlock(episode, targetIndex)
    } catch (error) {
      console.error('支付成功后刷新失败', error)
      wx.showToast({
        title: '刷新失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  async consumeEmbeddedPaymentResult() {
    const result = embeddedPayment.consumeMatchedReturnResult({
      source: enums.PAY_SOURCE.FORECAST,
      albumId: this.data.albumId,
    })
    if (!result) {
      return
    }
    await this.handlePaymentResult(result.payStatus, result.episodeIndex)
  },

  async onPaymentReturn(event) {
    const { status, episodeIndex } = event.detail
    await this.handlePaymentResult(status, episodeIndex)
  },

  showEpisodeDetailModal() {
    if (!this.data.episodeList.length) {
      return
    }
    this.setData({
      showEpisodeDetail: true,
    })
  },

  onEpisodeDetailClose() {
    if (!this.data.showEpisodeDetail) {
      return
    }
    this.setData({
      showEpisodeDetail: false,
    })
  },

  onEpisodeDetailItemChange(event) {
    if (this.data.isEpisodeChanging) {
      return
    }

    const index = Number(event.detail.index)
    const episode = this.getCurrentEpisode(index)
    if (!episode) {
      return
    }

    this.setData({
      isEpisodeChanging: true,
      showEpisodeDetail: false,
    })
    if (Number(episode.lock_status) === 0) {
      this.setData({
        showMask: false,
        showRefillModal: false,
      })
    }
    try {
      const radarPanel = this.selectComponent('#radarPanel')
      if (radarPanel && radarPanel.playEpisode) {
        radarPanel.playEpisode(index)
      }
    } catch (error) {
      console.warn('切换剧集失败', error)
    } finally {
      setTimeout(() => {
        this.setData({
          isEpisodeChanging: false,
        })
      }, 500)
    }
  },

  handleBack() {
    this.enableTheaterResumeFloat()
    this.reportCurrentHistory()

    appStore.update({
      pendingTheaterTab: 1,
    })

    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.reLaunch({
      url: '/pages/book-detail/theater/index?tab=1',
    })
  },
})
