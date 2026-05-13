function disableMiniProgramShare() {
  if (!wx || typeof wx.hideShareMenu !== 'function') {
    return;
  }

  try {
    wx.hideShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  } catch (error) {
    console.warn('隐藏分享菜单失败，改用基础方式重试---', error);
    wx.hideShareMenu();
  }
}

function wrapPageOptions(options = {}) {
  const pageOptions = Object.assign({}, options);
  const originalOnLoad = pageOptions.onLoad;
  const originalOnShow = pageOptions.onShow;

  pageOptions.onLoad = function wrappedOnLoad(...args) {
    disableMiniProgramShare();

    if (typeof originalOnLoad === 'function') {
      return originalOnLoad.apply(this, args);
    }
  };

  pageOptions.onShow = function wrappedOnShow(...args) {
    disableMiniProgramShare();

    if (typeof originalOnShow === 'function') {
      return originalOnShow.apply(this, args);
    }
  };

  return pageOptions;
}

function createPage(options) {
  Page(wrapPageOptions(options));
}

module.exports = {
  createPage,
  disableMiniProgramShare,
  wrapPageOptions,
};
