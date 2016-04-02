'use strict';

var auth = function (params) {
    var name = 'ProtoOAAuthReq';
    var payloadType = this.protocol.getPayloadTypeByName(name);
    return this.sendGuaranteedCommand(payloadType, {
        clientId: params.clientId,
        clientSecret: params.clientSecret
    });
};

module.exports = auth;
