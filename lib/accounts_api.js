var Promise = require('bluebird');
var request = require('request');
var request = Promise.promisify(require('request'));

var AccountsAPI = function() {
    this.site = "https://api.spotware.com/connect";
}

AccountsAPI.prototype.getTradingAccounts = function(token, callback) {
    console.log("[getTradingAccounts] url= " + this.site + "/tradingaccounts");
    console.log("[getTradingAccounts] args= " + getArgs(token));
    var url = this.site + "/tradingaccounts";
    var qs = { access_token:token };
    request({url:url, qs:qs}).nodeify(callback, { spread: true });
}

function getArgs(token, data) {
    if (!data) {
        data = {}
    }
    data.access_token = token;
    return data;
}

module.exports = AccountsAPI;

