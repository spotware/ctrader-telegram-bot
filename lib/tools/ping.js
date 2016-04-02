'use strict';

var ping = function (interval) {
    console.log("ping");
    var name = 'ProtoPingReq';
    var payloadType = this.protocol.getPayloadTypeByName(name);
    this.pingInterval = setInterval(function () {
        this.sendGuaranteedCommand(payloadType, {
            timestamp: Date.now()
        });
    }.bind(this), interval);
};

module.exports = ping;
