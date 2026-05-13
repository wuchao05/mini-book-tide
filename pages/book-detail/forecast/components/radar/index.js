const CommonApi = require('../../../../../services/book-detail/api/common')

const VIDEO_LOAD_TIMEOUT = 15000
const MAX_ERROR_RETRY = 2
const RETRY_DELAY_BASE = 1500
const RENDER_WINDOW_SIZE = 1

Component({
  properties: {
    episodes: {
      type: Array,
      value: [],
      observer: '_onEpisodesChange',
    },
    episodeDetail: {
      type: Object,
      value: null,
    },
    initialIndex: {
      type: Number,
      value: 0,
      observer: '_onInitialIndexChange',
    },
  },

  data: {
    currentIndex: 0,
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    progressPercent: 0,
    objectFit: 'cover',
    formattedCurrentTime: '00:00',
    formattedDuration: '00:00',
    showControls: true,
    isSeeking: 0,
  },

  lifetimes: {
    attached() {
      const systemInfo = wx.getSystemInfoSync()
      const platform = String(systemInfo.platform || '').toLowerCase()

      this._platform = platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'unknown'
      this._hideTimer = null
      this._tapTimer = null
      this._tapCount = 0
      this._mounted = true
      this._componentReady = false
      this._autoPlaying = false
      this._autoplayPending = false
      this._initialAutoplayResolved = false
      this._transitionPlayTarget = -1
      this._queuedAutoplay = false
      this._manualSwitchTarget = -1
      this._errorRetryCount = 0
      this._timeoutRetryCount = 0
      this._loadTimeoutTimer = null
      this._retryTimer = null
      this._pauseRecoveryTimer = null
      this._isRetrying = false
      this._loadEpisodeToken = null
      this._metadataLoaded = false
      this._playProgressObserved = false
    },

    ready() {
      this._componentReady = true
      this._ensureInitialAutoPlayRequested()
      if (this._queuedAutoplay) {
        this._queuedAutoplay = false
        this._queueAutoPlayCurrent()
      }
    },

    detached() {
      this._mounted = false
      this._componentReady = false
      this._clearAllTimers()
      this._autoPlaying = false
      this._autoplayPending = false
      this._initialAutoplayResolved = false
      this._transitionPlayTarget = -1
      this._queuedAutoplay = false
      this._manualSwitchTarget = -1
      this._isRetrying = false
      this._errorRetryCount = 0
      this._timeoutRetryCount = 0
      this._metadataLoaded = false
      this._playProgressObserved = false
    },
  },

  methods: {
    noop() {},

    _onEpisodesChange(newList) {
      if (!Array.isArray(newList) || !newList.length) {
        return
      }
      const maxIndex = newList.length - 1
      if (this.data.currentIndex > maxIndex) {
        this._updateIndex(Math.max(0, maxIndex))
      }

      this._ensureInitialAutoPlayRequested(newList)

      if (!this._autoplayPending) {
        return
      }

      const currentEpisode = newList[this.data.currentIndex]
      if (currentEpisode && Number(currentEpisode.lock_status) === 0) {
        this._queueAutoPlayCurrent()
      }
    },

    _onInitialIndexChange(value) {
      if (typeof value !== 'number' || value < 0) {
        return
      }
      const maxIndex = Math.max(0, (this.data.episodes.length || 1) - 1)
      const safeIndex = Math.min(value, maxIndex)
      this._initialAutoplayResolved = true
      const episode = this.data.episodes[safeIndex]

      if (safeIndex !== this.data.currentIndex) {
        this._transitionPlayTarget = episode && Number(episode.lock_status) === 0 ? safeIndex : -1
        this._updateIndex(safeIndex)
      } else {
        this._transitionPlayTarget = -1
      }

      if (!episode || Number(episode.lock_status) !== 0) {
        this._autoplayPending = false
        return
      }

      this._autoplayPending = true
      this._queueAutoPlayCurrent()
    },

    _ensureInitialAutoPlayRequested(episodes) {
      if (this._initialAutoplayResolved || !this._componentReady) {
        return
      }

      const list = Array.isArray(episodes) ? episodes : this.data.episodes
      if (!Array.isArray(list) || !list.length) {
        return
      }

      const maxIndex = list.length - 1
      const initialIndex = Math.max(0, Number(this.properties.initialIndex || 0))
      const safeIndex = Math.min(initialIndex, maxIndex)
      if (safeIndex !== this.data.currentIndex) {
        this._updateIndex(safeIndex)
      }

      this._initialAutoplayResolved = true

      const currentEpisode = list[safeIndex]
      if (!currentEpisode || Number(currentEpisode.lock_status) !== 0) {
        this._autoplayPending = false
        return
      }

      this._autoplayPending = true
      this._queueAutoPlayCurrent()
    },

    _clearAllTimers() {
      this._clearHideTimer()
      this._clearLoadTimeout()
      this._clearRetryTimer()
      this._clearPauseRecoveryTimer()
    },

    _clearLoadTimeout() {
      if (this._loadTimeoutTimer) {
        clearTimeout(this._loadTimeoutTimer)
        this._loadTimeoutTimer = null
      }
    },

    _clearRetryTimer() {
      if (this._retryTimer) {
        clearTimeout(this._retryTimer)
        this._retryTimer = null
      }
    },

    _clearPauseRecoveryTimer() {
      if (this._pauseRecoveryTimer) {
        clearTimeout(this._pauseRecoveryTimer)
        this._pauseRecoveryTimer = null
      }
    },

    _runAfterRender(callback) {
      if (typeof callback !== 'function') {
        return
      }

      const runner = () => {
        if (this._mounted) {
          callback()
        }
      }

      if (typeof wx.nextTick === 'function') {
        wx.nextTick(runner)
        return
      }

      Promise.resolve().then(runner)
    },

    _queueAutoPlayCurrent() {
      if (!this._mounted) {
        return
      }

      if (!this._componentReady) {
        this._queuedAutoplay = true
        return
      }

      this._queuedAutoplay = false
      this._runAfterRender(() => {
        this._autoPlayCurrent()
      })
    },

    _switchEpisode(newIndex, oldIndex) {
      if (newIndex === oldIndex) {
        return
      }

      try {
        const oldContext = this._getVideoContext(oldIndex)
        if (oldContext) {
          oldContext.pause()
        }
      } catch (error) {
        console.warn('停止旧视频失败', error)
      }

      this._clearHideTimer()
      this._errorRetryCount = 0
      this._timeoutRetryCount = 0
      this._isRetrying = false
      this._clearLoadTimeout()
      this._clearRetryTimer()
      this._clearPauseRecoveryTimer()
      this._loadEpisodeToken = null
      this._autoPlaying = false
      this._metadataLoaded = false
      this._playProgressObserved = false

      const episode = this.data.episodes[newIndex]
      this._autoplayPending = !!(episode && Number(episode.lock_status) === 0)
      this._transitionPlayTarget = episode && Number(episode.lock_status) === 0 ? newIndex : -1

      this.setData({
        currentIndex: newIndex,
        isPlaying: false,
        isLoading: false,
        currentTime: 0,
        duration: 0,
        progressPercent: 0,
        formattedCurrentTime: '00:00',
        formattedDuration: '00:00',
        showControls: true,
      })

      this.triggerEvent('episodechange', {
        index: newIndex,
        oldIndex,
        episode,
      })
    },

    _startLoadTimeout(episodeToken) {
      this._clearLoadTimeout()
      const token = episodeToken || this._loadEpisodeToken
      this._loadTimeoutTimer = setTimeout(() => {
        if (!this._mounted || !this.data.isLoading || token !== this._loadEpisodeToken) {
          return
        }
        this._handleLoadTimeout(token)
      }, VIDEO_LOAD_TIMEOUT)
    },

    _handleLoadTimeout(episodeToken) {
      if (this._isRetrying || !this._mounted || episodeToken !== this._loadEpisodeToken) {
        return
      }

      if (this._timeoutRetryCount >= 1) {
        this._isRetrying = false
        this.setData({ isLoading: false })
        this.triggerEvent('error', {
          index: this.data.currentIndex,
          error: 'load_timeout',
          episode: this.data.episodes[this.data.currentIndex],
        })
        return
      }

      this._clearLoadTimeout()
      this._isRetrying = true
      this._timeoutRetryCount += 1
      this.setData({ isLoading: false })

      try {
        const context = this._getVideoContext(this.data.currentIndex)
        if (!context) {
          return
        }
        context.pause()
        setTimeout(() => {
          if (!this._mounted || episodeToken !== this._loadEpisodeToken) {
            return
          }
          try {
            context.play()
            this.setData({ isLoading: true })
            this._startLoadTimeout(episodeToken)
          } catch (error) {
            console.warn('超时后重播失败', error)
            this.setData({ isLoading: false })
          }
        }, 300)
      } catch (error) {
        console.warn('处理加载超时失败', error)
        this.setData({ isLoading: false })
      }
    },

    _getVideoContext(index) {
      if (index === undefined || index === null || index < 0) {
        return null
      }
      if (!this._isInRenderWindow(index, this.data.currentIndex, this.data.episodes.length)) {
        return null
      }
      const context = wx.createVideoContext(`player_video_${index}`, this)
      if (!context || typeof context.pause !== 'function') {
        return null
      }
      return context
    },

    _isInRenderWindow(index, currentIndex, total) {
      if (index < 0 || currentIndex < 0 || !total) {
        return false
      }
      const min = Math.max(0, currentIndex - RENDER_WINDOW_SIZE)
      const max = Math.min(total - 1, currentIndex + RENDER_WINDOW_SIZE)
      return index >= min && index <= max
    },

    _updateIndex(index) {
      this.setData({
        currentIndex: index,
      })
    },

    _formatTime(seconds) {
      if (!seconds || !isFinite(seconds)) {
        return '00:00'
      }
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    },

    _resetHideTimer() {
      this._clearHideTimer()
      this._hideTimer = setTimeout(() => {
        if (this.data.isPlaying && this._mounted) {
          this.setData({ showControls: false })
        }
      }, 3000)
    },

    _clearHideTimer() {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer)
        this._hideTimer = null
      }
    },

    onVideoTap() {
      if (this._tapCount === 0) {
        this._tapCount = 1
        this._tapTimer = setTimeout(() => {
          if (this._tapCount === 1) {
            this._tapCount = 0
            this._handleSingleTap()
          }
        }, 250)
        return
      }

      this._tapCount = 0
      if (this._tapTimer) {
        clearTimeout(this._tapTimer)
        this._tapTimer = null
      }
    },

    _handleSingleTap() {
      if (!this._mounted) {
        return
      }

      const episode = this.data.episodes[this.data.currentIndex]
      if (!episode || Number(episode.lock_status) !== 0) {
        return
      }

      const context = this._getVideoContext(this.data.currentIndex)
      if (!context) {
        return
      }

      if (this.data.isPlaying) {
        context.pause()
      } else {
        context.play()
      }
      this.setData({ showControls: true })
      this._resetHideTimer()
    },

    play() {
      const context = this._getVideoContext(this.data.currentIndex)
      if (context) {
        context.play()
      }
    },

    pause() {
      const context = this._getVideoContext(this.data.currentIndex)
      if (context) {
        context.pause()
      }
    },

    onSwiperChange(event) {
      const newIndex = Number(event.detail.current)
      const oldIndex = this.data.currentIndex
      if (this._manualSwitchTarget === newIndex) {
        this._manualSwitchTarget = -1
        return
      }
      if (newIndex === oldIndex) {
        return
      }

      this._switchEpisode(newIndex, oldIndex)
    },

    _autoPlayCurrent() {
      if (!this._mounted) {
        return
      }

      const episode = this.data.episodes[this.data.currentIndex]
      if (!episode || Number(episode.lock_status) !== 0 || this._autoPlaying) {
        return
      }

      const context = this._getVideoContext(this.data.currentIndex)
      if (!context) {
        return
      }

      this._autoPlaying = true
      this._loadEpisodeToken = `${this.data.currentIndex}_${Date.now()}`
      this._errorRetryCount = 0
      this._timeoutRetryCount = 0
      this._isRetrying = false

      this.setData({
        isPlaying: true,
        isLoading: true,
      })
      if (!this._loadEpisodeToken) {
        this._loadEpisodeToken = `${this.data.currentIndex}_${Date.now()}`
      }
      this._startLoadTimeout(this._loadEpisodeToken)

      const currentToken = this._loadEpisodeToken
      try {
        context.play()
      } catch (error) {
        console.warn('自动播放失败', error)
        if (currentToken === this._loadEpisodeToken) {
          this.setData({ isLoading: false })
        }
        this._autoPlaying = false
      }
    },

    onSwiperTransitionEnd() {
      if (this._manualSwitchTarget === this.data.currentIndex) {
        this._manualSwitchTarget = -1
      }

      if (this._transitionPlayTarget !== this.data.currentIndex) {
        return
      }

      const episode = this.data.episodes[this.data.currentIndex]
      this._transitionPlayTarget = -1
      if (!episode) {
        return
      }

      if (Number(episode.lock_status) !== 0) {
        this.setData({
          isPlaying: false,
          isLoading: false,
        })
        return
      }

      this._queueAutoPlayCurrent()
    },

    onPlay(event) {
      if (!this._mounted) {
        return
      }
      const eventIndex = Number(event.currentTarget.dataset.index)
      if (eventIndex !== this.data.currentIndex) {
        return
      }

      this._clearPauseRecoveryTimer()
      this._errorRetryCount = 0
      this._isRetrying = false
      this._timeoutRetryCount = 0
      this._clearLoadTimeout()
      this._clearRetryTimer()

      this.setData({
        isPlaying: true,
        isLoading: false,
        isSeeking: Math.max(0, this.data.isSeeking - 1),
      })
      this._autoplayPending = false
      this._autoPlaying = false
      this._resetHideTimer()
      this.triggerEvent('play', { index: this.data.currentIndex })
    },

    onPause(event) {
      if (!this._mounted) {
        return
      }
      const eventIndex = Number(event.currentTarget.dataset.index)
      if (eventIndex !== this.data.currentIndex) {
        return
      }
      const episode = this.data.episodes[this.data.currentIndex]
      const shouldRecoverAutoPlay =
        !!episode &&
        Number(episode.lock_status) === 0 &&
        !this._metadataLoaded &&
        !this._playProgressObserved &&
        !this.data.isLoading &&
        this.data.currentTime <= 0

      this.setData({
        isPlaying: false,
        showControls: true,
      })
      this._clearHideTimer()

      if (shouldRecoverAutoPlay) {
        this._autoplayPending = true
        this._clearPauseRecoveryTimer()
        this._pauseRecoveryTimer = setTimeout(() => {
          if (!this._mounted || this.data.currentIndex !== eventIndex || this.data.isPlaying) {
            return
          }
          this._queueAutoPlayCurrent()
        }, 120)
      }

      this.triggerEvent('pause', { index: this.data.currentIndex })
    },

    onEnded(event) {
      if (!this._mounted) {
        return
      }
      const eventIndex = Number(event.currentTarget.dataset.index)
      if (eventIndex !== this.data.currentIndex) {
        return
      }
      this.setData({
        isPlaying: false,
        showControls: true,
      })
      this._clearLoadTimeout()
      this.triggerEvent('ended', { index: this.data.currentIndex })
    },

    onTimeUpdate(event) {
      if (!this._mounted) {
        return
      }
      const eventIndex = Number(event.currentTarget.dataset.index)
      if (eventIndex !== this.data.currentIndex) {
        return
      }

      const { currentTime, duration } = event.detail
      const percent = duration > 0 ? (currentTime / duration) * 100 : 0

      if (currentTime > 0) {
        this._playProgressObserved = true
      }

      this.setData({
        currentTime,
        duration,
        progressPercent: Math.min(percent, 100),
        formattedCurrentTime: this._formatTime(currentTime),
        formattedDuration: this._formatTime(duration),
      })
    },

    onLoadedMetadata(event) {
      if (!this._mounted) {
        return
      }
      const eventIndex = Number(event.currentTarget.dataset.index)
      if (eventIndex !== this.data.currentIndex) {
        return
      }

      const shouldResumeAutoPlay = this._autoplayPending
      this._metadataLoaded = true

      this._clearLoadTimeout()
      this._autoPlaying = false

      const duration = event.detail.duration
      this.setData({
        duration,
        isLoading: false,
        isSeeking: Math.max(0, this.data.isSeeking - 1),
        formattedDuration: this._formatTime(duration),
      })

      this.triggerEvent('loadedmetadata', {
        index: this.data.currentIndex,
        duration,
      })

      if (!shouldResumeAutoPlay) {
        return
      }

      const context = this._getVideoContext(this.data.currentIndex)
      if (!context) {
        return
      }

      this.setData({
        isPlaying: true,
        isLoading: true,
      })
      if (!this._loadEpisodeToken) {
        this._loadEpisodeToken = `${this.data.currentIndex}_${Date.now()}`
      }
      this._startLoadTimeout(this._loadEpisodeToken)

      try {
        context.play()
      } catch (error) {
        console.warn('元数据加载后补播失败', error)
        this.setData({ isLoading: false })
      }
    },

    onSeeked() {
      if (!this._mounted) {
        return
      }
      this.setData({
        isLoading: false,
      })
    },

    onWaiting(event) {
      if (!this._mounted || this.data.isSeeking > 0) {
        return
      }
      const eventIndex = Number(event.currentTarget.dataset.index)
      if (eventIndex !== this.data.currentIndex) {
        return
      }
      
      this.setData({ isLoading: true })
      this._startLoadTimeout(this._loadEpisodeToken)
      this.triggerEvent('waiting', { index: this.data.currentIndex })
    },

    onError(event) {
      if (!this._mounted) {
        return
      }
      const eventIndex = Number(event.currentTarget.dataset.index)
      if (eventIndex !== this.data.currentIndex) {
        return
      }

      const errorMessage = event.detail && event.detail.errMsg ? event.detail.errMsg : 'unknown'
      const errorCode = this._parseErrorCode(errorMessage)
      const episode = this.data.episodes[this.data.currentIndex]
      console.log(errorMessage,errorCode,episode.id);
      
      this._clearLoadTimeout()

      if (this._isHLSError(errorMessage)) {
        this._handleNetworkError(errorMessage, episode)
        return
      }
      CommonApi.errorReport({
        error_type: 'play_error',
        platform: this._platform,
        episode_id: episode ? episode.id : '',
        error_code:String(errorCode),
        error_message: errorMessage+'-'+(episode?episode.episode_no_text:'')+' id:'+ episode.id,
        album_id: this.data.episodeDetail.id,
      }).catch(() => {})

      if (this._isNetworkRelatedError(errorMessage, errorCode)) {
        this._handleNetworkError(errorMessage, episode)
        return
      }

      this.setData({ isLoading: false })
      this.triggerEvent('error', {
        index: this.data.currentIndex,
        error: errorMessage,
        episode,
      })
    },

    _parseErrorCode(errorMessage) {
      const match = String(errorMessage || '').match(/-?\d+/)
      return match ? parseInt(match[0], 10) : -1
    },

    _isNetworkRelatedError(errorMessage, errorCode) {
      const message = String(errorMessage || '').toLowerCase()
      const patterns = ['net::err_failed', 'net::', 'err_connection', 'err_network', 'timeout', 'abort', 'network']
      if (patterns.some((pattern) => message.includes(pattern))) {
        return true
      }
      return [-2, -3, -6].includes(errorCode)
    },

    _isHLSError(errorMessage) {
      const message = String(errorMessage || '').toLowerCase()
      return ['bufferseekoverhole', 'bufferappendend', 'hlserror', 'hls error', 'hls'].some((pattern) => message.includes(pattern))
    },

    _handleNetworkError(errorMessage, episode) {
      if (this._isRetrying || !this._mounted) {
        return
      }

      if (this._errorRetryCount >= MAX_ERROR_RETRY) {
        this._isRetrying = false
        this.setData({ isLoading: false })
        wx.showToast({
          title: '视频加载失败，请检查网络后重试',
          icon: 'none',
          duration: 2500,
        })
        this.triggerEvent('error', {
          index: this.data.currentIndex,
          error: errorMessage,
          episode,
        })
        return
      }

      this._errorRetryCount += 1
      this._isRetrying = true

      const delay = RETRY_DELAY_BASE * Math.pow(2, this._errorRetryCount - 1)
      this._clearRetryTimer()
      this._retryTimer = setTimeout(() => {
        this._retryPlay()
      }, delay)
    },

    _retryPlay() {
      if (!this._mounted) {
        this._isRetrying = false
        return
      }

      const currentIndex = this.data.currentIndex
      const episode = this.data.episodes[currentIndex]
      if (!episode || Number(episode.lock_status) !== 0) {
        this._isRetrying = false
        return
      }

      try {
        const context = this._getVideoContext(currentIndex)
        if (!context) {
          this._isRetrying = false
          return
        }

        context.pause()
        this.setData({
          isLoading: true,
          isPlaying: false,
          currentTime: 0,
          progressPercent: 0,
          formattedCurrentTime: '00:00',
        })

        setTimeout(() => {
          if (!this._mounted) {
            return
          }
          try {
            context.play()
            this._startLoadTimeout(this._loadEpisodeToken)
          } catch (error) {
            console.warn('重试播放失败', error)
            this.setData({ isLoading: false })
            this._isRetrying = false
          }
        }, 200)
      } catch (error) {
        console.warn('重试播放异常', error)
        this.setData({ isLoading: false })
        this._isRetrying = false
      }
    },

    onSliderChanging(event) {
      const percent = event.detail.value
      const newTime = (percent / 100) * this.data.duration
      this.setData({
        progressPercent: percent,
        formattedCurrentTime: this._formatTime(newTime),
        isSeeking: this.data.isSeeking + 1,
        isLoading: false,
      })
    },

    onSliderChange(event) {
      const percent = event.detail.value
      const newTime = (percent / 100) * this.data.duration
      const context = this._getVideoContext(this.data.currentIndex)
      if (!context || this.data.duration <= 0) {
        return
      }

      this.setData({
        isSeeking: this.data.isSeeking + 1,
        isLoading: false,
        showControls: true,
      })
      this._resetHideTimer()
      context.seek(newTime)
      context.play()
    },

    playEpisode(index) {
      if (!this._mounted) {
        return
      }

      const episode = this.data.episodes[index]
      if (!episode) {
        return
      }

      if (index !== this.data.currentIndex) {
        const oldIndex = this.data.currentIndex
        this._manualSwitchTarget = index
        this._switchEpisode(index, oldIndex)

        if (Number(episode.lock_status) !== 0) {
          return
        }
        return
      }

      if (Number(episode.lock_status) !== 0) {
        this._autoplayPending = false
        this.triggerEvent('episodechange', { index, episode })
        return
      }

      this._autoplayPending = true
      this._queueAutoPlayCurrent()
    },

    handleBack() {
      this.triggerEvent('back')
    },

    getCurrentIndex() {
      return this.data.currentIndex
    },

    getIsPlaying() {
      return this.data.isPlaying
    },
  },
})
