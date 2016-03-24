var Client = require('node-rest-client').Client;
var client = new Client();

var AccountsAPI = function() {
    this.site = "https://api.spotware.com/connect";
}

AccountsAPI.prototype.getTradingAccounts = function(token, handler) {
    console.log("[getTradingAccounts] url= " + this.site + "/tradingaccounts");
    console.log("[getTradingAccounts] args= " + getArgs(token));

    client.get(this.site + "/tradingaccounts", getArgs(token), handler);
    /*
        function (data, response) {
            // parsed response body as js object
            console.log(data);
            // raw response
            console.log(response);
        });
    */
}

function getArgs(token, data) {
    if (!data) {
        data = {}
    }
    data.access_token = token;
    return {
        data: data,
        headers: { "Content-Type": "application/json" }
    };
}
