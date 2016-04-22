var bb = require('bot-brother');
var bluebird = require('bluebird');
var redis = require('redis');

var config = require('./config');
var texts = require('./texts');
var AccountsAPI = require('./accounts_api.js');
AccountsAPI = new AccountsAPI();

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
    .invoke(function (ctx) {
        AccountsAPI.getTradingAccounts(ctx.session.access_token).then(
            function(result) {
                ctx.session.accounts = result.body.data;
                var keyboard = ctx.session.accounts.reduce(
                    function(keyboard, account){
                        var accountLabel = (account.live ? "Live" : "Demo") + " " + account.accountNumber + " " + account.brokerTitle;
                        var button = {}
                        button[accountLabel] = account.accountNumber;
                        keyboard.push([button])
                        return keyboard;
                    },
                    []);
                ctx.keyboard(keyboard);
                ctx.sendMessage('main.accounts');
            }
        );
    })
    .answer(function (ctx) {
        console.log("ctx.answer= " + ctx.answer);
        ctx.session.account = ctx.answer;
        return ctx.sendMessage('answer.success').then(function () {
            return ctx.goBack();
        });
    });

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