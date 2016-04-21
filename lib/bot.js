var bb = require('bot-brother');
var bluebird = require('bluebird');
var redis = require('redis');

var config = require('./config');
var texts = require('./texts');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

var redisClient = redis.createClient(config.redis);
redisClient.on("error", function (err) {
    console.log("Error " + err);
});

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
        [{'button.like': {
            go: 'rate',
            isShown: function (ctx) {
                return !ctx.session.rate && ctx.session.notificationsCounter > 1 && ctx.session.createDate + 120e3 < Date.now();
            }
        }}],
        [{'button.add': {go: 'add'}}],
        [{'button.list': {
            go: 'list',
            isShown: function (ctx) {
                return 0; //ctx.notifications.length;
            }
        }}],
        [{'button.settings': {go: 'settings'}}]
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

        if (!/^settings_/.test(ctx.command.name)) {
            if (!ctx.session.locale) {
                return ctx.go('settings_locale');
            }
        }
    });

bot.command('start')
    .invoke(function (ctx) {
        return ctx.sendMessage('main.start');
    });

bot.command('auth')
    .invoke(function (ctx) {
    ctx.data.oauthState = ctx.meta.chat.id;
    return ctx.sendMessage('main.auth');
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