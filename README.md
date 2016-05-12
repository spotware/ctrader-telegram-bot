# ctrader-telegram-bot
Telegram bot @cTraderBot using Spotware Connect API for trading operations

![cTrader Telegram Bot](https://raw.githubusercontent.com/spotware/spotware.github.io/master/screenshots/ctrader-telegram-bot.png "cTrader Telegram Bot")

![Alt text](http://g.gravizo.com/g?
  digraph usage {
    "connect-js-adapter-tls" -> "connect-js-api";
    "connect-protobuf-messages" -> "connect-js-api";
    "connect-js-encode-decode" -> "connect-js-api";
    "ctrader-telegram-bot" [style=filled,color="grey"];
    "connect-js-api" -> "ctrader-telegram-bot";
    "connect-js-api" -> "connect-nodejs-samples";
  }
)
