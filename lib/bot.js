// dependencies
var _ = require('lomath');

// API as superclass that bot inherits methods from
var API = require('telegram-bot-bootstrap')
var TradingAPI = require(__dirname + '/trading_api.js')
var AccountsAPI = require(__dirname + '/accounts_api.js')

// The bot object prototype
// bot extends and inherits methods of API
var bot = function(params) {
    var self = this;
    API.apply(this, [params.token]);
    this.app = params.app;
    this.redisClient = params.redisClient;
    // set webhook on construction: override the old webhook
    this.setWebhook(params.webhookUrl);
    var tradingApiParams = {
        host: 'tradeapi.spotware.com',
        port: 5032,
        clientId: params.clientId,
        clientSecret: params.clientSecret
    };
    this.tradingAPI = new TradingAPI(tradingApiParams);
    this.accountsAPI = new AccountsAPI();
    this.tradingAPI.onSpotEvent(function (msg) {
        self.redisClient.get("subscriptions:" + msg.subscriptionId, function (err, chatId) {
            self.sendMessage(chatId, msg.symbolName + ', Bid: ' + msg.bidPrice + ', Ask: ' + msg.askPrice, undefined, undefined, createBuySellKeyboard(msg));
        });
    });
    this.tradingAPI.start();
}

// set prototype to API
bot.prototype = API.prototype;
// set constructor back to bot
bot.prototype.constructor = bot;

/**
 * Handles a Telegram Update object sent from the server. Extend this method for your bot.
 *
 * @category Bot
 * @param {Object} req The incoming HTTP request.
 * @param {Object} res The HTTP response in return.
 * @returns {Promise} promise A promise returned from calling Telegram API method(s) for chaining.
 *
 * @example
 * var bot1 = new bot('yourtokenhere');
 * ...express server setup
 * app.route('/')
 * // robot API as middleware
 * .post(function(req, res) {
 *     bot1.handle(req, res)
 * })
 * // Then bot will handle the incoming Update from you, routed from Telegram!
 *
 */
bot.prototype.handle = function(req, res) {
    var self = this;
    // the Telegram Update object. Useful shits
    var Update = req.body,
        // the telegram Message object
        Message = Update.message,
        // the user who sent it
        userId = Message.from.id,
        // id of the chat(room)
        chatId = Message.chat.id,
        // Message text
        text = Message.text;
    if (text && text.startsWith("/")) {
        this.redisClient.get("tokens:" + chatId, function (err, token) {
            if (!token) {
                text = "/auth";
            } else {
                try {
                    token = JSON.parse(token);
                } catch(e) {
                    self.redisClient.del("tokens:" + chatId);
                    text = "/auth";
                } 
            }
            switch (text) {
                case "/start":
                    self.redisClient.get("accounts:" + token.token.access_token,  function (err, accounts) {
                        if (!accounts) {
                            self.sendMessage(chatId, "Accounts are not loaded");
                        } else {
                            try {
                                console.log(accounts);
                                accounts = JSON.parse(accounts);
                                self.tradingAPI.sendSubscribeForSpotsRequest(accounts.data[0].accountId, 'EURUSD', token.token.access_token)
                                    .then(function(respond) {
                                        self.redisClient.set("subscriptions:" + respond.subscriptionId, chatId);
                                    });
                            } catch(e) {
                                console.log(e);
                                self.redisClient.del("accounts:" + token.token.access_token);
                            }
                        }
                    }); 
                    break;
                case "/stop":
                    self.tradingAPI.sendUnsubscribeFromSpotsRes();
                    break;
                case "/auth":
                    self.sendMessage(chatId, "Please authenticate your cTrader ID: https://ctrader-telegram-bot.herokuapp.com/auth?state=" + chatId);
                    break;
                case "/accounts":
                    self.accountsAPI.getTradingAccounts(token.token.access_token,
                        function (error, result) {
                            if (error) {
                                console.log('Get Trading Accounts Error', error.message);
                            } else {
                                self.redisClient.set("accounts:" + token.token.access_token, result.body);
                                self.app.render('accounts', JSON.parse(result.body), function(err, message) {
                                    self.sendMessage(chatId, message);
                                });
                            }
                        });
                    break;
                case "/clean":
                    self.redisClient.keys("*", function(err, key) {
                        self.redisClient.del(key, function(err) {});
                    });
                    self.sendMessage(chatId, "Storage is cleaned");
                    break;
                case "/EURUSD":
                    var params = {symbol:"EURUSD", bidPrice:1.13464, askPrice:1.13482}
                    self.sendMessage(chatId, "Choose an action", undefined, undefined, createBuySellKeyboard(params));
                    break;
                default:
                    self.sendMessage(chatId, "Sorry, unknown command: " + Message.text);
            }
        });
    }
}

bot.prototype.saveToken = function(token, state) {
    this.redisClient.set("tokens:" + state, JSON.stringify(token));
    this.sendMessage(state, "Authenticated successfully");
}

function createBuySellKeyboard(params) {
    return {
        keyboard: [
            ['/sell ' + params.bidPrice, '/buy ' + params.askPrice],
            ["/stop"]
        ],
        one_time_keyboard: true
    }
}

// export the bot class
module.exports = bot;

// sample keyboard
var kb = {
    keyboard: [
        ['one', 'two'],
        ['three'],
        ['four']
    ],
    one_time_keyboard: true
}
