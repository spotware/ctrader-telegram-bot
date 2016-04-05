'use strict';

var TradingAPI = require('../lib/trading_api.js');

describe('TradingAPI', function () {
    var params = {
        host: 'sandbox-tradeapi.spotware.com',
        port: 5032,
        clientId: '7_5az7pj935owsss8kgokcco84wc8osk0g0gksow0ow4s4ocwwgc',
        clientSecret: '49p1ynqfy7c4sw84gwoogwwsk8cocg8ow8gc8o80c0ws448cs4'
    };
    var accountId = 62002;
    var accessToken = 'test002_access_token';
    var symblolName = 'EURUSD';

    var tradingAPI;

    beforeAll(function () {
        tradingAPI = new TradingAPI(params);
        tradingAPI.start();
    });
    it('sendSubscribeForSpotsRequest', function (done) {
        tradingAPI.sendSubscribeForSpotsRequest(accountId, symblolName, accessToken).then(done);
    });
    it('onSpotEvent', function (done) {
        tradingAPI.sendSubscribeForSpotsRequest(accountId, symblolName, accessToken).then(function() {
            tradingAPI.onSpotEvent(done);
        });
    });
});
