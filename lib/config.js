var _ = require('lodash');
var path = require('path')

module.exports = {
  bot: {
    key: process.env.TELEGRAM_TOKEN || 'your example Telegram Bot token',
    botanio: {
      key: process.env.BOTANIO_TOKEN
    }
  },
  redis: process.env.REDIS_URL || 'A redis instance URL for your app',
  dir: {
    root: path.resolve(__dirname, '../')
  },
  defaults: {
    locale: 'en',
    timezone: 'Europe/Moscow'
  },
  connectApi: {
    accountsApiUrl : 'https://api.spotware.com/connect',
    tradingApiHost: 'tradeapi.spotware.com',
    tradingApiPort: 5032,
    clientId: process.env.CLIENT_ID || 'your Spotware Connect Client Public ID',
    clientSecret: process.env.CLIENT_SECRET || 'your Spotware Connect Client Secret',
    plotly: {
      username: process.env.PLOTLY_USERNAME || 'your Plotly username',
      apiKey: process.env.PLOTLY_API_KEY || 'your Plotly API key'
    }
  }
};

if (process.env.WEBHOOK) {
  module.exports.bot.webHook = {
    url: process.env.WEBHOOK,
    host: process.env.WEBHOOK_HOST,
    port: 8080
  };
} else {
  module.exports.bot.polling = {
    interval: 100,
    timeout: 0
  }
}

// try to require local config
try {
  _.merge(module.exports, require('./local'));
} catch (e) {

}
