'use strict';

var TradingAPI = require('../lib/trading_api.js')

    describe('TradingAPI', function () {
        var params = {
            host: 'sandbox-tradeapi.spotware.com',
            port: 5032,
            clientId: '7_5az7pj935owsss8kgokcco84wc8osk0g0gksow0ow4s4ocwwgc',
            clientSecret: '49p1ynqfy7c4sw84gwoogwwsk8cocg8ow8gc8o80c0ws448cs4'
        }
        var accountId = 62002;
        var accessToken = 'test002_access_token';
        var symblolName = 'EURUSD';

        var tradingAPI;

        it('test0', function () {
            console.log("test0");
            tradingAPI = new TradingAPI(params);
            /*
            tradingAPI.on("Connected", function () {
                console.log("Open API Connected");
            });
            tradingAPI.on("AUTH_RES", function() {
                console.log("Authenticated");
                tradingAPI.sendSubscribeForSpotsRequest(accountId, symblolName, accessToken);
            });
            tradingAPI.on("OA_SPOT_EVENT", function (msg) {
                console.log(msg.symbolName + ', Bid: ' + msg.bidPrice + ', Ask: ' + msg.askPrice);
            });*/
            tradingAPI.start();
        });
    });

    it('test1', function () {
        console.log("test1");
    });
