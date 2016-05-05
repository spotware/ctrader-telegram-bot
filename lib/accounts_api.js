var Promise = require('bluebird');
var request = Promise.promisify(require('request'));
var PlotlyFinance = require('plotlyjs-finance');
var Plotly = require('plotly');
var moment = require('moment');
var fs = require('fs');

var AccountsAPI = function(params) {
    this.site = params.accountsApiUrl;
    this.plotly = new Plotly (params.plotly.username, params.plotly.apiKey);
};

AccountsAPI.prototype.getProfile = function(token) {
    var url = this.site + "/profile";
    var qs = { access_token:token };
    request({url:url, qs:qs, json:true});
};

AccountsAPI.prototype.getTradingAccounts = function(token) {
    var url = this.site + "/tradingaccounts";
    var qs = { access_token:token };
    return request({url:url, qs:qs, json:true});
};

AccountsAPI.prototype.getSymbols = function(accountId, token) {
    var url = this.site + "/tradingaccounts/" + accountId + "/symbols";
    var qs = { access_token:token };
    return request({url:url, qs:qs, json:true});
};

AccountsAPI.prototype.getPendingOrders = function(accountId, token) {
    var url = this.site + "/tradingaccounts/" + accountId + "/pendingorders";
    var qs = { access_token:token };
    return request({url:url, qs:qs, json:true});
};

AccountsAPI.prototype.getPositions = function(accountId, token) {
    var url = this.site + "/tradingaccounts/" + accountId + "/positions";
    var qs = { access_token:token };
    return request({url:url, qs:qs, json:true});
};

AccountsAPI.prototype.getChart = function(symbolName, accountId, token) {
    var url = this.site + "/tradingaccounts/" + accountId + "/symbols/" + symbolName + "/trendbars/m1";
    var fromDate = moment().subtract(1, 'hours');
    var toDate = moment();
    var qs = {
        from : fromDate.utc().format('YYYYMMDDHHmmss'),
        to : toDate.utc().format('YYYYMMDDHHmmss'),
        access_token : token,
    };
    return request({url:url, qs:qs, json:true}).then(function (result) {
        var trendbars = result.body.data;
        var data = trendbars.reduce(function (data, trendbar) {
            data.open.push(trendbar.open);
            data.high.push(trendbar.high);
            data.low.push(trendbar.low);
            data.close.push(trendbar.close);
            data.dates.push(moment.utc(trendbar.timestamp));
            return data;
        }, {
            open: [],
            high: [],
            low: [],
            close: [],
            dates: []
        });

        var fig = PlotlyFinance.createCandlestick(data,{name: symbolName});
        var imgOpts = {
            format: 'png',
            width: 1024,
            height: 768
        };
        var getImage = Promise.promisify(this.plotly.getImage, {context: this.plotly});
        return getImage(fig, imgOpts);
    }.bind(this));
};

module.exports = AccountsAPI;

