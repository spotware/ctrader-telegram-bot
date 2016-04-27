var Promise = require('bluebird');
var request = Promise.promisify(require('request'));

var AccountsAPI = function() {
    this.site = "https://api.spotware.com/connect";
}

AccountsAPI.prototype.getProfile = function(token) {
    var url = this.site + "/profile";
    var qs = { access_token:token };
    request({url:url, qs:qs, json:true});
}

AccountsAPI.prototype.getTradingAccounts = function(token) {
    var url = this.site + "/tradingaccounts";
    var qs = { access_token:token };
    return request({url:url, qs:qs, json:true});
}

AccountsAPI.prototype.getSymbols = function(accountId, token) {
    var url = this.site + "/tradingaccounts/" + accountId + "/symbols";
    var qs = { access_token:token };
    return request({url:url, qs:qs, json:true});
}

AccountsAPI.prototype.getPendingOrders = function(accountId, token) {
    var url = this.site + "/tradingaccounts/" + accountId + "/pendingorders";
    var qs = { access_token:token };
    return request({url:url, qs:qs, json:true});
}

AccountsAPI.prototype.getPositions = function(accountId, token) {
    var url = this.site + "/tradingaccounts/" + accountId + "/positions";
    var qs = { access_token:token };
    return request({url:url, qs:qs, json:true});
}

module.exports = AccountsAPI;

