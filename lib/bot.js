// dependencies
var _ = require('lomath');

// API as superclass that bot inherits methods from
var API = require('telegram-bot-bootstrap')
var TradingAPI = require(__dirname + '/trading_api.js')
var AccountsAPI = require(__dirname + '/accounts_api.js')

// The bot object prototype
// bot extends and inherits methods of API
var bot = function(app, redisClient, token, webhookUrl) {
    API.apply(this, arguments);
    this.app = app;
    this.redisClient = redisClient;
    var self = this;
    // set webhook on construction: override the old webhook
    this.setWebhook(webhookUrl || '');
    this.tradingAPI = new TradingAPI();
    this.accountsAPI = new AccountsAPI();
    this.tradingAPI.on("Connected", function () {
        self.sendMessage(self.currentChatId, "Open API Connected");
    });
    this.tradingAPI.on("AUTH_RES", function() {
        self.sendMessage(self.currentChatId, "Authenticated");
        //self.tradingAPI.sendSubscribeForSpotsRequest(188328, "EURUSD", tokens[self.currentChatId]);
    });
    this.tradingAPI.on("OA_SPOT_EVENT", function (msg) {
        self.sendMessage(self.currentChatId, msg.symbolName + ', Bid: ' + msg.bidPrice + ', Ask: ' + msg.askPrice);
    });
    this.tradingAPI.init();
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
        this.redisClient.get("tokens." + chatId, function (err, token) {
            if (!token) {
                text = "/auth";
            }
            switch (text) {
                case "/start":
                    this.sendMessage(chatId, "/start is coming soon...");
                    break;
                case "/stop":
                    this.tradingAPI.destroy();
                    break;
                case "/auth":
                    this.sendMessage(chatId, "Please authenticate your cTrader ID: https://ctrader-telegram-bot.herokuapp.com/auth?state=" + chatId);
                    break;
                case "/accounts":
                    this.accountsAPI.getTradingAccounts(token.token.access_token,
                        function (error, result) {
                            if (error) {
                                console.log('Get Trading Accounts Error', error.message);
                            } else {
                                self.app.render('accounts', JSON.parse(result.body), function(err, message) {
                                    self.sendMessage(chatId, message);
                                });
                            }
                        });
                    break;
                default:
                    this.sendMessage(chatId, "Sorry, unknown command: " + Message.text);
            }
        });
    }
}

bot.prototype.saveToken = function(token, state) {
    this.redisClient.put("tokens." + state, token);
    this.sendMessage(state, "Authenticated successfully");
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
