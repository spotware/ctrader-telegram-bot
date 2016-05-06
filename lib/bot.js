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

var protectedCommands = ['start', 'sell', 'volumes', 'buy', 'symbols', 'chart', 'positions', 'orders', 'accounts'];
var volumesRef = {
    '1k': 100000,
    '5k': 500000,
    '10k': 1000000,
    '20k': 2000000,
    '30k': 3000000,
    '40k': 4000000,
    '50k': 5000000,
    '60k': 6000000,
    '70k': 7000000,
    '80k': 8000000,
    '90k': 9000000,
    '100k': 10000000
};

var defaultVolume = '1k';
var defaultSymbolName = 'EURUSD';

var bot = module.exports = bb({
    key: config.bot.key,
    redis: { client: redisClient },
    webHook: config.bot.webHook,
    polling: config.bot.polling
})
    .texts(texts.ru, {locale: 'ru'})
    .texts(texts.en, {locale: 'en'})
    .texts(texts.default)
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
        if (!ctx.session.access_token) {
            ctx.keyboard(createLoginKeyboard());
            if (protectedCommands.indexOf(ctx.command.name) != -1) {
                return ctx.go('not_authenticated');
            }
        } else {
            ctx.keyboard(createTradeKeyboard());
        }
        /*if (!/^settings_/.test(ctx.command.name)) {
            if (!ctx.session.locale) {
                return ctx.go('settings_locale');
            }
        }*/
    })
    .use('before', function (ctx) {
        if (!ctx.data.bidPrice) {
            ctx.data.bidPrice = "";
        }
        if (!ctx.data.askPrice) {
            ctx.data.askPrice = "";
        }
        if (!ctx.session.volume) {
            ctx.session.volume = defaultVolume;
        }
        if (!ctx.session.symbolName) {
            ctx.session.symbolName = defaultSymbolName;
        }
        var account = ctx.session.account;
        if (!account) {
            ctx.data.accountLabel = "Choose an account";
        } else {
            ctx.data.accountLabel = account.accountNumber + " " + account.brokerTitle + " " + (account.live ? "Live" : "Demo");
        }
        ctx.data.symbolName = ctx.session.symbolName;
        ctx.data.volume = ctx.session.volume;
    });

bot.command('not_authenticated')
    .invoke(function (ctx) {
        return ctx.sendMessage('main.not_authenticated');
    });

bot.command('auth')
    .invoke(function (ctx) {
        ctx.data.oauthState = ctx.meta.chat.id;
        return ctx.sendMessage('main.auth');
    });

    bot.command('start')
        .invoke(function (ctx) {
            var accessToken = ctx.session.access_token;
            var account = ctx.session.account;
            if (account) {
                TradingAPI.checkOrSubscribeForTradingEventsRequest(
                    {
                        accountId: account.accountId,
                        accessToken: accessToken,
                        chatId: ctx.meta.chat.id
                    });
            }
            return ctx.sendMessage('main.start');
        });

bot.command('accounts')
    .use('beforeInvoke', function (ctx) {
        console.log('Accounts. start');
        return AccountsAPI.getTradingAccounts(ctx.session.access_token).then(
            function (result) {
                console.log('Accounts. got');
                ctx.session.accounts = result.body.data;
            }
        );
    })
    .invoke(function (ctx) {
        var keyboard = ctx.session.accounts.reduce(
            function (keyboard, account, index) {
                var accountLabel = account.accountNumber + " " + account.brokerTitle + " " + (account.live ? "Live" : "Demo");
                var button = {};
                button[accountLabel] = new String(index);
                keyboard.push([button]);
                return keyboard;
            },
            []);
        keyboard.push('backButton');
        ctx.keyboard(keyboard);
        console.log('Accounts. reply');
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
    .use('beforeInvoke', function (ctx) {
        console.log('Symbols. start');
        return AccountsAPI.getSymbols(ctx.session.account.accountId, ctx.session.access_token).then(
            function (result) {
                console.log('Symbols. got');
                ctx.session.symbols = result.body.data;
            }
        );
    })
    .invoke(function (ctx) {
        var keyboard = ctx.session.symbols.reduce(
            function (keyboard, symbol, index) {
                if (index % 4 == 0) {
                    keyboard.push([]);
                }
                var button = {};
                button[symbol.symbolName] = new String(index);
                keyboard[keyboard.length - 1].push(button);
                return keyboard;
            },
            []);
        keyboard.push('backButton');
        ctx.keyboard(keyboard);
        console.log('Symbols. reply');
        ctx.sendMessage('main.symbols');
    })
    .answer(function (ctx) {
        console.log("ctx.answer= " + ctx.answer);
        ctx.session.symbolName = ctx.session.symbols[ctx.answer].symbolName;
        return ctx.sendMessage('answer.success').then(function () {
            return ctx.goBack();
        });
    });

bot.command('volumes')
    .invoke(function (ctx) {
        var keyboard = Object.keys(volumesRef).reduce(
            function (keyboard, key, index) {
                if (index % 4 == 0) {
                    keyboard.push([]);
                }
                var button = {};
                button[key] = key;
                keyboard[keyboard.length - 1].push(button);
                return keyboard;
            },
            []);
        keyboard.push('backButton');
        ctx.keyboard(keyboard);
        ctx.sendMessage('main.volumes');
    })
    .answer(function (ctx) {
        console.log("ctx.answer= " + ctx.answer);
        ctx.session.volume = ctx.answer;
        return ctx.sendMessage('answer.success').then(function () {
            return ctx.goBack();
        });
    });

bot.command('positions')
    .use('beforeInvoke', function (ctx) {
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
                var reverseButton = {'button.position.reverse' : {value: {action: 'reverse', positionId: position.positionId, volume: position.volume}}};
                var doubleButton = {'button.position.double' : {value: {action: 'double', positionId: position.positionId, volume: position.volume}}};
                var closeButton = {'button.position.close' : {value: {action: 'close', positionId: position.positionId, volume: position.volume}}};
                keyboard.push([button, reverseButton, doubleButton, closeButton]);
                return keyboard;
            },
            []);
        keyboard.push('backButton');
        ctx.keyboard(keyboard);
        ctx.data.positionsCount =  ctx.session.positions.length;
        ctx.sendMessage('main.positions');
    })
    .answer(function (ctx) {
        if (ctx.answer && ctx.answer.action) {
            switch (ctx.answer.action) {
                case 'close' :
                    TradingAPI.closePositionRequest({
                        accessToken: ctx.session.access_token,
                        accountId: ctx.session.account.accountId,
                        positionId: ctx.answer.positionId,
                        volume: ctx.answer.volume
                    });
                    break;
                default :
                    ctx.sendMessage('TODO: action ' + ctx.answer.action + ' is not supported yet');
                    break;
            }
        }
        console.log(ctx.answer);
    });

bot.command('orders')
    .invoke(function (ctx) {
        ctx.sendMessage('The /orders command is not implemented yet');
    });

bot.command('buy')
    .invoke(function (ctx) {
        var ProtoTradeSide = TradingAPI.protocol.enums.ProtoTradeSide;
        TradingAPI.sendMarketOrderRequest({
            accountId: ctx.session.account.accountId,
            symbolName: ctx.session.symbolName,
            tradeSide: ProtoTradeSide.BUY,
            volume: volumesRef[ctx.session.volume],
            accessToken: ctx.session.access_token
        });
    });

bot.command('sell')
    .invoke(function (ctx) {
        var ProtoTradeSide = TradingAPI.protocol.enums.ProtoTradeSide;
        TradingAPI.sendMarketOrderRequest({
            accountId: ctx.session.account.accountId,
            symbolName: ctx.session.symbolName,
            tradeSide: ProtoTradeSide.SELL,
            volume: volumesRef[ctx.session.volume],
            accessToken: ctx.session.access_token
        });
    });

bot.command('chart')
    .invoke(function (ctx) {
        AccountsAPI.getChart(ctx.session.symbolName, ctx.session.account.accountId, ctx.session.access_token).then(function (imageStream) {
            imageStream.path = imageStream.path + ctx.session.symbolName + '.png';
            ctx.sendPhoto(imageStream, {caption: ctx.session.symbolName + '.png'});
        });
    });

bot.command('settings')
    .invoke(function (ctx) {
        ctx.data.settings = {
            locale: ctx.getLocale()
        };
        return ctx.sendMessage('settings.main');
    })
    .keyboard([
        [{'button.locale': {go: 'settings_locale'}}],
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

bot.command('exit')
    .invoke(function (ctx) {
        ctx.session.access_token = null;
        ctx.session.accounts = null;
        ctx.session.account = null;
        ctx.session.symbols = null;
        ctx.session.symbolName = null;
        return ctx.sendMessage('main.exit');
    })
    .keyboard(createLoginKeyboard());


function createLoginKeyboard() {
    return [
        [{'button.auth': {go: 'auth' }}],
        [{'button.locale': {go: 'settings_locale'}}]
    ]
}

function createTradeKeyboard() {
    return [
        [{'button.sell' : {go: 'sell'}}, {'button.volume' : {go: 'volumes'}}, {'button.buy' : {go: 'buy'}}],
        [{'button.symbol' : {go: 'symbols'}}, {'button.chart' : {go: 'chart'}}, {'button.positions' : {go: 'positions'}}, {'button.orders' : {go: 'orders'}}],
        [{'button.account' : {go: 'accounts'}}, {'button.settings' : {go: 'settings'}}, {'button.exit' : {go: 'exit'}}]
    ]
}

TradingAPI.on('ProtoOAExecutionEvent', function (chatId, msg) {
    console.log(msg);
    bot.withContext(chatId, function (ctx) {
        var ProtoTradeSide = TradingAPI.protocol.enums.ProtoTradeSide;
        ctx.data.event = {
            tradeSide: msg.order.tradeSide == ProtoTradeSide.BUY ? 'BUY' : 'SELL',
            volume: msg.order.requestedVolume / 100,
            symbolName: msg.order.symbolName
        }
        var ProtoOAExecutionType = TradingAPI.protocol.enums.ProtoOAExecutionType;
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
