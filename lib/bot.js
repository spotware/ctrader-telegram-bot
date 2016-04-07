// dependencies
var _ = require('lomath');
var emoji = require('node-emoji');
var fs = require('fs');

// API as superclass that bot inherits methods from
var API = require('telegram-bot-bootstrap')
var TradingAPI = require(__dirname + '/trading_api.js')
var AccountsAPI = require(__dirname + '/accounts_api.js')

var authCommands = ["/auth", "Log In", "Sign Up"];
var defaultSymbolName = "EURUSD";
var defaultVolume = "1k";

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
            self.sendMessage(chatId, msg.symbolName + ', Bid: ' + msg.bidPrice + ', Ask: ' + msg.askPrice);
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
    if (text) {
        text = trimMessage(text);
        self.sendMessage(chatId, "You said " + text);
        this.redisClient.get("tokens:" + chatId, function (err, token) {
            if (authCommands.indexOf(text) == -1) {
                if (!token) {
                    self.sendMessage(chatId, "Please log in with cTrader ID or sign up", undefined, undefined, createAuthKeyboard());
                    return;
                } else {
                    try {
                        token = JSON.parse(token);
                    } catch(e) {
                        self.redisClient.del("tokens:" + chatId);
                        text = "/auth";
                    }
                }
            }
            switch (text) {
                case "/start":
                    self.redisClient.get("accountId:" + chatId,  function (err, accountId) {
                        self.tradingAPI.sendSubscribeForSpotsRequest(accountId, defaultSymbolName, token.token.access_token)
                            .then(function(respond) {
                                self.redisClient.set("subscriptions:" + respond.subscriptionId, chatId);
                        });
                    });
                    break;
                case "/stop":
                    self.tradingAPI.sendUnsubscribeFromSpotsRes();
                    break;
                case "/auth":
                case "Log In":
                case "Sign Up":
                    self.sendMessage(chatId, "Open this link to authorize the bot: https://ctrader-telegram-bot.herokuapp.com/auth?state=" + chatId);
                    break;
                case "/accounts":
                    self.accountsAPI.getTradingAccounts(token.token.access_token,
                        function (error, result) {
                            if (error) {
                                console.log('Get Trading Accounts Error', error.message);
                            } else {
                                self.app.render('accounts', result.body, function(err, message) {
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
                case 'Change Symbol':
                    self.sendMessage(chatId, "Current symbol is EURUSD. Choose a symbol", undefined, undefined, createSymbolsKeyboard());
                    break;
                case "Change Volume":
                    self.sendMessage(chatId, "Current volume is 1k. Choose a volume", undefined, undefined, createVolumeKeyboard());
                    break;
                case "/chart":
                case "Chart":
                    console.log(__dirname + '/views/img/chart.svg');
                    self.sendPhoto(chatId, fs.createReadStream(__dirname + '/views/img/chart.svg'), 'EURUSD m1');
                    break;
                case "/buy":
                case "/sell":
                default:
                    self.redisClient.get("accountId:" + chatId, function(account) {
                        try {
                            account = JSON.parse(account);
                            var params = {
                                symbolName: defaultSymbolName,
                                volume: defaultVolume,
                                accountNumber: account.accountNumber,
                                positionsCount: 0,
                                ordersCount: 0
                            };
                            var keyboard = createTradeKeyboard(params)
                        } catch(e) {
                            self.redisClient.del("accountId:" + chatId);
                        }
                        self.sendMessage(chatId, "Sorry, unknown command: " + Message.text, undefined, undefined, keyboard);
                    });
                    break;
            }
        });
    }
}

bot.prototype.saveToken = function(token, chatId) {
    var self = this;
    this.redisClient.set("tokens:" + chatId, JSON.stringify(token));
    this.accountsAPI.getProfile(token.token.access_token,
        function (error, result) {
            if (error) {
                console.log('Get Profile Error', error.message);
            } else {
                var profile = result.body.data;
                self.accountsAPI.getTradingAccounts(token.token.access_token,
                    function (error, result) {
                        if (error) {
                            console.log('Get Trading Accounts Error', error.message);
                        } else {
                            var accounts = result.body.data;
                            var account = accounts[0];
                            self.redisClient.set("accountId:" + chatId, account.accountId);
                            var params = {
                                symbolName: defaultSymbolName,
                                volume: defaultVolume,
                                accountNumber: account.accountNumber,
                                positionsCount: 0,
                                ordersCount: 0
                            };
                            self.sendMessage(chatId, "Hello, " + profile.nickname + "! Let's trade!", undefined, undefined, createTradeKeyboard(params));
                        }
                    });
            }
        });
}

bot.prototype.setDefaultAccount = function(chatId, account) {
    this.redisClient.set("account:" + chatId, JSON.stringify(token));
}

function trimMessage(msg) {
    return msg.replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF])/g, '').trim();
}

function createTradeKeyboard(params) {
    return {
        keyboard: [
            ['Sell ' + params.volume + " " + params.symbolName, 'Buy ' + params.volume + " " + params.symbolName],
            ['Change Symbol', 'Change Volume', 'Chart'],
            [emoji.emojify(':information_source: ' + params.accountNumber), 'Positions', 'Orders']
        ]
    }
}

function createSymbolsKeyboard(params) {
    return {
        keyboard: [
            ['EURUSD', 'USDJPY'],
            ['GBPUSD', 'USDCHF']
        ]
    }
}

function createVolumeKeyboard(params) {
    return {
        keyboard: [
            ['1k', '2k', '5k', '10k'],
            ['10k', '25k', '50k', '100k']
        ]
    }
}

function createAuthKeyboard() {
    return {
        keyboard: [
            [emoji.emojify(':key: Log In')],
            [emoji.emojify(':bust_in_silhouette: Sign Up')],
            [emoji.emojify(':question: Help')]
        ]
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
