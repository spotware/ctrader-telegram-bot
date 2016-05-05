'use strict';

var tls = require('tls');
var util = require('util');
var EventEmitter = require('events');
var AdapterTLS = require('connect-js-adapter-tls');
var Connect = require('connect-js-api');
var ProtoMessages = require('connect-protobuf-messages');
var EncodeDecode = require('connect-js-encode-decode');
var ping = require('./tools/ping');
var auth = require('./tools/auth');


// Ping interval in milliseconds
var PING_INTERVAL = 1000;

var TradingAPI = function(params) {
    EventEmitter.call(this);
    this.protocol = new ProtoMessages([
        {
            file: 'node_modules/connect-protobuf-messages/src/main/protobuf/CommonMessages.proto',
            protoPayloadType: 'ProtoPayloadType'
        },
        {
            file: 'node_modules/connect-protobuf-messages/src/main/protobuf/OpenApiMessages.proto',
            protoPayloadType: 'ProtoOAPayloadType'
        }
    ]);
    this.protocol.load();
    this.protocol.build();

    var adapter = new AdapterTLS({
        host: params.tradingApiHost,
        port: params.tradingApiPort
    });
    var encodeDecode = new EncodeDecode();

    this.connect = new Connect({
        adapter: adapter,
        encodeDecode: encodeDecode,
        protocol: this.protocol
    });

    ping = ping.bind(this.connect);
    auth = auth.bind(this.connect);

    this.connect.onConnect = function () {
        ping(PING_INTERVAL);
        auth({
            clientId: params.clientId,
            clientSecret: params.clientSecret
        });
    };
    this.executionSubscriptionMap = {};
    this.connect.on(this.protocol.getPayloadTypeByName('ProtoOAExecutionEvent'), this.onExecutionEvent.bind(this));

    this.spotSubscriptionMap = {};
    this.connect.on(this.protocol.getPayloadTypeByName('ProtoOASpotEvent'), this.onSpotEvent.bind(this));
    this.connect.start();
};

util.inherits(TradingAPI, EventEmitter);

TradingAPI.prototype.sendMarketOrderRequest = function (params) {
    var ProtoOAOrderType = this.protocol.enums.ProtoOAOrderType;
    return this.connect.sendGuaranteedCommand(
        this.protocol.getPayloadTypeByName('ProtoOACreateOrderReq'),
        {
            accountId: params.accountId,
            symbolName: params.symbolName,
            orderType: ProtoOAOrderType.OA_MARKET,
            tradeSide: params.tradeSide,
            volume: params.volume,
            accessToken: params.accessToken
        }
    ).then(function (result) {
        this.onExecutionEvent(result);
    }.bind(this));
};

TradingAPI.prototype.closePositionRequest = function (params) {
    return this.connect.sendGuaranteedCommand(
        this.protocol.getPayloadTypeByName('ProtoOAClosePositionReq'),
        {
            accessToken: params.accessToken,
            accountId: params.accountId,
            positionId: params.positionId,
            volume: params.volume
        }
    ).then(function (result) {
        this.onExecutionEvent(result);
    }.bind(this));
};


// Subscribing for trading events
TradingAPI.prototype.sendSubscribeForTradingEventsRequest = function (params) {
    this.connect.sendGuaranteedCommand(
        this.protocol.getPayloadTypeByName('ProtoOASubscribeForTradingEventsReq'),
        {
            accountId: params.accountId,
            accessToken: params.accessToken
        }
    ).then(function (res) {
        this.executionSubscriptionMap[params.accountId] = params.chatId;
    }.bind(this));
};

TradingAPI.prototype.checkOrSubscribeForTradingEventsRequest = function (params) {
    var chatId = this.executionSubscriptionMap[params.accountId];
    var subscribed = chatId == params.chatId;
    if (!subscribed) {
        this.sendSubscribeForTradingEventsRequest(params);
    }
    return subscribed;
};

// Subscribing for spot prices
TradingAPI.prototype.sendSubscribeForSpotsRequest = function (params) {
    return this.connect.sendGuaranteedCommand(
        this.protocol.getPayloadTypeByName('ProtoOASubscribeForSpotsReq'),
        {
            accountId: params.accountId,
            accessToken: params.accessToken,
            symblolName: params.symblolName
        }
    ).then(function (res) {
        this.spotSubscriptionMap[res.subscriptionId] = params.chatId;
    }.bind(this));
};

// Unsubscribing for spot prices
TradingAPI.prototype.sendUnsubscribeFromSpotsRes = function () {
    return this.connect.sendGuaranteedCommand(
        this.protocol.getPayloadTypeByName('ProtoOAUnsubscribeFromSpotsReq'),
        {}
    );
};

// Execution events
TradingAPI.prototype.onExecutionEvent = function (msg) {
    var chatId = this.executionSubscriptionMap[msg.order.accountId];
    if (chatId) {
        this.emit('ProtoOAExecutionEvent', chatId, msg);
    }
};

// Spot events
TradingAPI.prototype.onSpotEvent = function (msg) {
    var chatId = this.spotSubscriptionMap[msg.subscriptionId];
    if (chatId) {
        this.emit('ProtoOASpotEvent', chatId, msg);
    }
};

module.exports = TradingAPI;
