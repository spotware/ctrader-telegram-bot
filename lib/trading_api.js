'use strict';

var tls = require('tls');
var util = require('util');
var EventEmitter = require('events');
var AdapterTLS = require('connect-js-api').AdapterTLS;
var Connect = require('connect-js-api').Connect;
var ProtoMessages = require('connect-protobuf-messages');
var EncodeDecode = require('connect-js-api').EncodeDecode;
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

TradingAPI.prototype.sendMarketOrderRequest = function (accountId, symbolName, tradeSide, volume, accessToken) {
    var ProtoOAOrderType = this.protocol.getPayloadTypeByName('ProtoOAOrderType');
    return this.connect.sendGuaranteedCommand(
        this.protocol.getPayloadTypeByName('ProtoOACreateOrderReq'),
        {
            accountId: accountId,
            symbolName: symbolName,
            orderType: ProtoOAOrderType.OA_MARKET,
            tradeSide: tradeSide,
            volume: volume,
            accessToken: accessToken
        }
    );
}

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
/*
// Proto Message Builds
var commonBuilder = protobuf.loadProtoFile('proto/CommonMessages.proto');
var openApiBuilder = protobuf.loadProtoFile('proto/OpenApiMessages.proto');

// Buffers
var PingBuf = commonBuilder.build('ProtoPingReq');
var OAuthBuf = openApiBuilder.build('ProtoOAAuthReq');
var ProtoMessageBuf = commonBuilder.build('ProtoMessage');
var ErrorBuf = commonBuilder.build('ProtoErrorRes');

var TradingAPI = function() {
    this.host = "tradeapi.spotware.com";
    this.port = 5032;
    this.clientPublicId = "51_5by19hk03kow8sw0wcw88oo08c8g8wks48k84c0kks04kc0sok";
    this.clientSecret = "2cy6wj37c4g0s880wwkkowscc4gsgg8kosw0wkck8okwggcw8";
}
TradingAPI.prototype = new events.EventEmitter;

var pingInterval;
var start = Math.floor(new Date() / 1000);

TradingAPI.prototype.init = function() {
    var self = this;
    this.socket = tls.connect(this.port, this.host, function() {
        self.emit('Connected');
        console.log('Connected');
        // Sending pings in a loop
        pingInterval = setInterval(function() {
            var pingBuf = new PingBuf({
                payloadType: 'PING_REQ',
                timestamp: Math.floor(new Date())
            });
            console.log('Sending ping...');
            var msg = wrapMessage(pingBuf);
            self.socket.write(getLength(msg));
            self.socket.write(msg);
        }, 1000);
        // Authenticating
        var oAuthBuf = new OAuthBuf({
            payloadType: 'OA_AUTH_REQ',
            clientId: self.clientPublicId,
            clientSecret: self.clientSecret
        });
        console.log('Sending auth Request...');
        var msg = wrapMessage(oAuthBuf);
        self.socket.write(getLength(msg));
        self.socket.write(msg);
    });
    this.transport = new protostream.Stream(ProtoMessageBuf, this.socket, 4);
    this.transport.on('message', function(data) {
        var payloadType = data.payloadType;

        switch( payloadType ) {
            case 50:
                console.log( 'ERROR_RES' );
                var msg = ErrorBuf.decode(data.payload);
                console.log(chalk.red('Received error response'));
                console.log(chalk.red(msg.description));
                break;
            case 51:
                console.log( 'HEARTBEAT_EVENT' );
                break;
            case 52:
                console.log( 'PING_REQ' );
                break;
            case 53:
                console.log( 'PING_RES' );
                break;
            case 2000:
                console.log( 'AUTH_REQ');
                break;
            case 2001:
                console.log( 'AUTH_RES');
                self.emit('AUTH_RES');
                break;
            case 2002:
                console.log( 'OA_SUBSCRIBE_FOR_TRADING_EVENTS_REQ' );
                break;
            case 2003:
                console.log( 'OA_SUBSCRIBE_FOR_TRADING_EVENTS_RES' );
                break;
            case 2004:
                console.log( 'OA_UNSUBSCRIBE_FROM_TRADING_EVENTS_REQ' );
                break;
            case 2005:
                console.log( 'OA_UNSUBSCRIBE_FROM_TRADING_EVENTS_RES' );
                break;
            case 2006:
                console.log( 'OA_GET_SUBSCRIBED_ACCOUNTS_REQ' );
                break;
            case 2007:
                console.log( 'OA_GET_SUBSCRIBED_ACCOUNTS_RES' )
                break;
            case 2013:
                console.log( 'OA_CREATE_ORDER_REQ' );
                break;
            case 2016:
                console.log( 'OA_EXECUTION_EVENT' );
                break;
            case 2017:
                console.log( 'OA_CANCEL_ORDER_REQ' );
                break;
            case 2018:
                console.log( 'OA_CLOSE_POSITION_REQ' );
                break;
            case 2019:
                console.log( 'OA_AMEND_POSITION_SL_TP_REQ' );
                break;
            case 2020:
                console.log( 'OA_AMEND_ORDER_REQ' );
                break;
            case 2021:
                console.log( 'OA_SUBSCRIBE_FOR_SPOTS_REQ' );
                break;
            case 2022:
                console.log( 'OA_SUBSCRIBE_FOR_SPOTS_RES' );
                break;
            case 2023:
                console.log( 'OA_UNSUBSCRIBE_FROM_SPOTS_REQ' );
                break;
            case 2024:
                console.log( 'OA_UNSUBSCRIBE_FROM_SPOTS_RES' );
                break;
            case 2025:
                console.log( 'OA_GET_SPOT_SUBSCRIPTION_REQ' );
                break;
            case 2026:
                console.log( 'OA_GET_SPOT_SUBSCRIPTION_RES' );
                break;
            case 2027:
                console.log( 'OA_GET_ALL_SPOT_SUBSCRIPTIONS_REQ' );
                break;
            case 2028:
                console.log( 'OA_GET_ALL_SPOT_SUBSCRIPTIONS_RES' );
                break;
            case 2029:
                console.log( 'OA_SPOT_EVENT' );
                var ProtoOASpotEvent = openApiBuilder.build('ProtoOASpotEvent');
                var msg = ProtoOASpotEvent.decode(data.payload);
                console.log(chalk.blue('Bid price: ' + msg.bidPrice + ', ask price: ' + msg.askPrice));
                self.emit('OA_SPOT_EVENT', msg);
                break;
            default:
                console.log('Received misc payloadType: ' + payloadType);
                break;
        }
    });
    this.socket.on('end', function() {
        var finish = Math.floor(new Date() / 1000);
        var secs = finish - start;
        console.log('Connection closed in ' + secs.toString() + ' secs');
        clearInterval(pingInterval);
    });

    this.socket.on('error', function(e) {
        console.log(chalk.red(e));
    });
}

TradingAPI.prototype.sendSubscribeForTradingEventsRequest = function (accountId) {
}

// Subscribing for spot prices
TradingAPI.prototype.sendSubscribeForSpotsRequest = function (accountId, symbol, accessToken) {
    var self = this;
    var ProtoOASubscribeForSpotsReq = openApiBuilder.build('ProtoOASubscribeForSpotsReq');
    var protoOASubscribeForSpotsReq = new ProtoOASubscribeForSpotsReq ({
        payloadType: 'OA_SUBSCRIBE_FOR_SPOTS_REQ',
        accountId: accountId,
        accessToken: accessToken,
        symblolName: symbol
    });
    console.log('Sending subscribe event...');
    var msg = wrapMessage(protoOASubscribeForSpotsReq);
    this.transport.send(msg);
}

TradingAPI.prototype.destroy = function () {
    this.socket.destroy();
}


function wrapMessage(data) {
    var protoMessageBuf = new ProtoMessageBuf({
        payloadType: data.payloadType,
        payload: data.toBuffer(),
        clientMsgId: null
    });
    return protoMessageBuf.toBuffer();
}

function getLength(msg) {
    var sizeBuf = bytebuffer.allocate(4);
    sizeBuf.putInt(msg.length);
    return sizeBuf.get(0, 4);
}
*/
