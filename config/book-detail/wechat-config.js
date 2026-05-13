const { getAllMiniAppProfiles } = require('../miniapp-profiles');

const primaryMiniAppConfigs = getAllMiniAppProfiles()
  .filter((profile) => profile.appId && profile.appIdentifier)
  .map((profile) => ({
    name: profile.appName,
    appid: profile.appId,
    app: profile.appIdentifier,
  }));

const extraConfigs = [
  {
    name: '彩创memo',
    appid: 'wx83824d117c994f28',
    app: 'caichuangmemo_wx_miniprogram',
  },
  {
    name: '比高精选',
    appid: 'wx0832a7945f08944d',
    app: 'bigao_wx_miniprogram',
  },
  {
    name: '云途精选',
    appid: 'wxb6109138e25d824b',
    app: 'yuntu_wx_miniprogram',
  },
  {
    name: '高点精选',
    appid: 'wx99e1d799e3cb2042',
    app: 'gaodian_wx_miniprogram',
  },
  {
    name: '天高精选',
    appid: 'wx99ef627efc0543a9',
    app: 'tiangao_wx_miniprogram',
  },
  {
    name: '云芸间memo',
    appid: 'wx3c633a44ee951bf8',
    app: 'yunyunjianmemo_wx_miniprogram',
  },
  {
    name: '蒲公英精选',
    appid: 'wxedf03676fe01c7a1',
    app: 'pugongying_wx_miniprogram',
  },
  {
    name: '茶树精选',
    appid: 'wxbbffef16ce71373c',
    app: 'chashu_wx_miniprogram',
  },
  {
    name: '风信子精选',
    appid: 'wx7875fb2dab8b305d',
    app: 'fengxinzi_wx_miniprogram',
  },
  {
    name: '蓝蝶精选',
    appid: 'wx2216f69c0f4318fc',
    app: 'landie_wx_miniprogram',
  },
  {
    name: '九零精选',
    appid: 'wx94c94128cde931ba',
    app: 'jiuling_wx_miniprogram',
  },
  {
    name: '起舞精选',
    appid: 'wxfcc1235c89919bf7',
    app: 'qiwu_wx_miniprogram',
  },
  {
    name: '瓜酱精选',
    appid: 'wxe0b74ada883852c0',
    app: 'guajiang_wx_miniprogram',
  },
  {
    name: '酱酱剧院',
    appid: 'wx6060257b5c67f60f',
    app: 'jiangjiang_wx_miniprogram',
  },
  {
    name: '酱瓜影视',
    appid: 'wxb2a458a9b08b747c',
    app: 'jianggua_wx_miniprogram',
  },
  {
    name: '甜酱精选',
    appid: 'wx1bdf33ef30d643a0',
    app: 'tianjiang_wx_miniprogram',
  },
  {
    name: '维拓精选',
    appid: 'wxbc0a55dc13b18746',
    app: 'weituo_wx_miniprogram',
  },
];

const configs = primaryMiniAppConfigs.concat(
  extraConfigs.filter(
    (config) => !primaryMiniAppConfigs.some((item) => item.appid === config.appid),
  ),
);

function getWeixinMiniProgramConfig(appid) {
  return configs.find((item) => item.appid === appid)
}

module.exports = {
  configs,
  getWeixinMiniProgramConfig,
}
