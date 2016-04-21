var Promise = require('bluebird');
var request = require('request');
var request = Promise.promisify(require('request'));

var AccountsAPI = function() {
    this.site = "https://api.spotware.com/connect";
}

AccountsAPI.prototype.getProfile = function(token, callback) {
    var url = this.site + "/profile";
    var qs = { access_token:token };
    request({url:url, qs:qs, json:true}).nodeify(callback, { spread: true });
}

AccountsAPI.prototype.getTradingAccounts = function(token) {
    var url = this.site + "/tradingaccounts";
    var qs = { access_token:token };
    //request({url:url, qs:qs, json:true}).nodeify(callback, { spread: true });
    return request({url:url, qs:qs, json:true});
}

function getArgs(token, data) {
    if (!data) {
        data = {}
    }
    data.access_token = token;
    return data;
}

module.exports = AccountsAPI;

