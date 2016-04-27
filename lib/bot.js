var bb = require('bot-brother');
var bluebird = require('bluebird');
var redis = require('redis');

var config = require('./config');
var texts = require('./texts');
var AccountsAPI = require('./accounts_api.js');
var TradingAPI = require('./trading_api.js')

AccountsAPI = new AccountsAPI(config.connectApi);
TradingAPI = new TradingAPI(config.connectApi);

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

var redisClient = redis.createClient(config.redis);
redisClient.on("error", function (err) {
    console.log("Error " + err);
});

var protectedCommands = ['start'];

var bot = module.exports = bb({
    key: config.bot.key,
    redis: { client: redisClient },
    webHook: config.bot.webHook,
    polling: config.bot.polling
})
    .texts(texts.ru, {locale: 'ru'})
    .texts(texts.en, {locale: 'en'})
    .texts(texts.default)
    .keyboard([
        [{ 'button.auth': { go: 'auth' } }],
        [{ 'button.locale': { go: 'settings_locale' } }]
    ])
    .keyboard('backButton', [
        [{
            'button.back': {
                handler: function (ctx) {
                    return ctx.goBack();
                },
                isShown: function (ctx) {
                    return !ctx.hideBackButton;
                }
            }
        }]
    ])
    .use('before', bb.middlewares.typing())
    .use('before', bb.middlewares.botanio(config.bot.botanio.key))
    .use('before', function (ctx) {
        ctx.data.user = ctx.meta.user;
        ctx.settings = ctx.settings || {};
        ctx.setLocale(ctx.session.locale || config.defaults.locale);
        console.log("ctx.meta.chat.id= " + ctx.meta.chat.id);
        console.log("ctx.session.access_token= " + ctx.session.access_token);
        if (!ctx.session.access_token && protectedCommands.indexOf(ctx.command.name) != -1) {
            return ctx.go('not_authenticated');
        }
        /*if (!/^settings_/.test(ctx.command.name)) {
            if (!ctx.session.locale) {
                return ctx.go('settings_locale');
            }
        }*/
    });

bot.command('not_authenticated')
    .invoke(function (ctx) {
        return ctx.sendMessage('main.start');
    }).keyboard([
        [{ 'button.auth': { go: 'auth' } }],
        [{ 'button.locale': { go: 'settings_locale' } }]
    ]);

bot.command('auth')
    .invoke(function (ctx) {
        ctx.data.oauthState = ctx.meta.chat.id;
        return ctx.sendMessage('main.auth');
    });

bot.command('start')
    .invoke(function (ctx) {
        return ctx.sendMessage('main.start');
    });

bot.command('accounts')
    .use('before', function (ctx) {
        return AccountsAPI.getTradingAccounts(ctx.session.access_token).then(
            function (result) {
                ctx.session.accounts = result.body.data;
            }
        );
    })
    .invoke(function (ctx) {
        var keyboard = ctx.session.accounts.reduce(
            function (keyboard, account, index) {
                var accountLabel = (account.live ? "Live" : "Demo") + " " + account.accountNumber + " " + account.brokerTitle;
                var button = {};
                button[accountLabel] = new String(index);
                keyboard.push([button]);
                return keyboard;
            },
                                []);
        ctx.keyboard(keyboard);
        ctx.sendMessage('main.accounts');
    })
    .answer(function (ctx) {
        ctx.session.account = ctx.session.accounts[ctx.answer];
        TradingAPI.sendSubscribeForTradingEventsRequest ({
                accountId: ctx.session.account.accountId,
                accessToken: ctx.session.access_token,
                chatId: ctx.meta.chat.id
            });
        return ctx.sendMessage('answer.success').then(function () {
            return ctx.goBack();
        });
    });

bot.command('symbols')
    .use('before', function (ctx) {
        return AccountsAPI.getSymbols(ctx.session.account.accountId, ctx.session.access_token).then(
            function (result) {
                ctx.session.symbols = result.body.data;
            }
        );
    })
    .invoke(function (ctx) {
        var keyboard = ctx.session.symbols.reduce(
            function (keyboard, symbol, index) {
                var button = {};
                button[symbol.symbolName] = new String(index);
                keyboard.push([button]);
                return keyboard;
            },
            []);
        ctx.keyboard(keyboard);
        ctx.sendMessage('main.symbols');
    })
    .answer(function (ctx) {
        console.log("ctx.answer= " + ctx.answer);
        ctx.session.symbol = ctx.session.symbols[ctx.answer];
        return ctx.sendMessage('answer.success').then(function () {
            return ctx.goBack();
        });
    });

bot.command('positions')
    .use('before', function (ctx) {
        return AccountsAPI.getPositions(ctx.session.account.accountId, ctx.session.access_token).then(
            function (result) {
                ctx.session.positions = result.body.data;
            }
        );
    })
    .invoke(function (ctx) {
        var keyboard = ctx.session.positions.reduce(
            function (keyboard, position, index) {
                var positionLabel = position.tradeSide + " " + position.volume + " " + position.symbolName;
                var button = {};
                button[positionLabel] = new String(position.positionId);
                var closeButton = {'button.close' : 'close' + position.positionId}
                keyboard.push([button, closeButton]);
                return keyboard;
            },
            []);
        ctx.keyboard(keyboard);
        ctx.sendMessage('main.positions');
    })
    .answer(function (ctx) {
        console.log("ctx.answer= " + ctx.answer);
    });

bot.command('buy');
bot.command('sell');

bot.command('settings')
    .invoke(function (ctx) {
        ctx.data.settings = {
            locale: ctx.getLocale(),
            timezone: ctx.timezone
        };
        return ctx.sendMessage('settings.main');
    })
    .keyboard([
        [{'button.locale': {go: 'settings_locale'}}],
        [{'button.timezone': {go: 'settings_timezone'}}],
        'backButton'
    ]);

// Setting locale
bot.command('settings_locale')
    .invoke(function (ctx) {
        if (!ctx.session.locale) {
            ctx.hideBackButton = true;
        }
        return ctx.sendMessage('settings.locale');
    })
    .answer(function (ctx) {
        ctx.session.locale = ctx.answer;
        ctx.setLocale(ctx.answer);
        return ctx.sendMessage('answer.success').then(function () {
            return ctx.goBack();
        });
    })
    .keyboard([[
        {'buttons.ru': 'ru'},
        {'buttons.en': 'en'},
    ],
        'backButton'
    ]);

bot.command('help').invoke(function (ctx) {
    return ctx.sendMessage('main.help');
});

TradingAPI.on('ProtoOAExecutionEvent', function (chatId, msg) {
    bot.withContext(chatId, function (ctx) {
        var ProtoTradeSide = TradingAPI.protoMessages.ProtoTradeSide;
        ctx.data.tradeSide = msg.order.tradeSide == ProtoTradeSide.BUY ? 'BUY' : 'SELL';
        ctx.data.volume = msg.order.requestedVolume / 100;
        ctx.data.symbolName = msg.order.symbolName;

        var ProtoOAExecutionType = TradingAPI.protoMessages.ProtoOAExecutionType;
        switch (msg.executionType) {
            case ProtoOAExecutionType.OA_ORDER_FILLED:
                var message = 'event.order.filled';
                break;
            case ProtoOAExecutionType.OA_ORDER_CANCELLED:
                var message = 'event.order.cancelled';
                break;
            case ProtoOAExecutionType.OA_ORDER_EXPIRED:
                var message = 'event.order.cancelled';
                break;
        }
        if (message) {
            return ctx.sendMessage(message);
        }
    });
});