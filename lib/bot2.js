'use strict'

var Telegram = require('telegram-node-bot')
var tg;

var bot = function(params) {
    tg = new Telegram(params.token);
    tg.router.
        when(['ping'], 'PingController')

    tg.controller('PingController', ($) => {
        tg.for('ping', () => {
            $.sendMessage('pong')
        })
    })
}

bot.prototype.handle = function(req, res) {
    var Update = req.body,
    // the telegram Message object
    Message = Update.message,
    // the user who sent it
    userId = Message.from.id,
    // id of the chat(room)
    chatId = Message.chat.id,
    // Message text
    text = Message.text;
    tg.routeTo(chatId, text);
}

bot.prototype.saveToken = function(token, chatId) {
}

// export the bot class
module.exports = bot;


