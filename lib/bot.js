// dependencies
var _ = require('lomath');

// API as superclass that bot inherits methods from
var API = require('telegram-bot-bootstrap')
//var TradingAPI = require(__dirname + '/TradingAPI.js')
//var AccountsAPI = require(__dirname + '/AccountsAPI.js')
var tokens = {}

// The bot object prototype
// bot extends and inherits methods of API
var bot = function(token, webhookUrl) {
    API.apply(this, arguments);
    var self = this;
    // set webhook on construction: override the old webhook
    this.setWebhook(webhookUrl || '');
    /*
    this.tradingAPI = new TradingAPI();
    this.tradingAPI.on("Connected", function () {
        self.sendMessage(self.currentChatId, "Open API Connected");
    });
    this.tradingAPI.on("AUTH_RES", function() {
        self.sendMessage(self.currentChatId, "Authenticated");
        self.tradingAPI.sendSubscribeForSpotsRequest(188328, "EURUSD", tokens[self.currentChatId]);
    });
    this.tradingAPI.on("OA_SPOT_EVENT", function (msg) {
        self.sendMessage(self.currentChatId, msg.symbolName + ', Bid: ' + msg.bidPrice + ', Ask: ' + msg.askPrice);
    });
    */
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
        chatId = Message.chat.id;

    ////////////////////////
    // Extend from here:  //
    ////////////////////////
    // you may call the methods from API.js, which are all inherited by this bot class

    // echo
    if (Message.text == "/start") {
        var token = tokens[chatId];
        if (token) {
            //this.tradingAPI.init(token);
        } else {
            this.sendMessage(chatId, "Please authenticate your cTrader ID: https://ctrader-telegram-bot.herokuapp.com/auth?state=" + chatId);
        }
        this.currentChatId = Message.chat.id;
    }
    if (Message.text == "/stop") {
        //this.tradingAPI.destroy();
    }
    if (Message.text == "/auth") {
        this.sendMessage(chatId, "https://ctrader-telegram-bot.herokuapp.com/auth?state=" + chatId);
    }
    /*
    if (Message.text == "/accounts") {
        AccountsAPI.getTradingAccounts(tokens[chatId],
            function (data, response) {
                // parsed response body as js object
                console.log(data);
                // raw response
                console.log(response);
                self.sendMessage(self.currentChatId, data);
            });
    }*/
    this.sendMessage(chatId, "you said: " + Message.text);
}

bot.prototype.saveToken = function(token, state) {
    this.sendMessage(state, "Authenticated successfully");
    tokens[state] = token;
    //this.tradingAPI.init(token);
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
