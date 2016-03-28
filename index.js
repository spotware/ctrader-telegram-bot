// dependencies
var url = require('url');
// express
var _ = require('lomath');
var express = require('express');
var app = express();
// express middlewares
var morgan = require('morgan');
var ejs = require('ejs');
var bodyParser = require('body-parser');
var multer = require('multer');
// telegram bot
var bot = require(__dirname + '/lib/bot.js');
//redis
var redis = require('redis').createClient(process.env.REDIS_URL);
redis.on("error", function (err) {
    console.log("Error " + err);
});

// global settings
var token = process.env.TOKEN || 'your example Telegram Bot token';
var webhookUrl = process.env.WEBHOOK || 'your app webhook url';
var clientID = process.env.CLIENT_ID || 'your Spotware Connect Client Public ID';
var clientSecret = process.env.CLIENT_SECRET || 'your Spotware Connect Client Secret';

console.log("token=" + token);
console.log("webhookUrl=" + webhookUrl);
console.log("clientID=" + clientID);
console.log("clientSecret=" + clientSecret);

var oauth2 = require('simple-oauth2')({
    clientID: clientID,
    clientSecret: clientSecret,
    site: 'https://connect.spotware.com',
    tokenPath: '/oauth/v2/token',
    authorizationPath: '/oauth/v2/auth'
});

var cTraderBot = new bot(app, token, webhookUrl);

// engine to render HTML
app.engine('.html', ejs.__express);
app.set('view engine', 'html');
// set the port number
app.set('port', process.env.PORT || 8443);

// Mount middlewares defaulted for root:
// log all HTTP calls for debugging
app.use(morgan('combined'));
// use resources for html: HTML, JS and CSS etc.
app.use(express.static(__dirname + '/views'));
// parse incoming formData into JSON
app.use(bodyParser.json());

// Initial page redirecting to Github
app.get('/auth', function (req, res) {
    // Authorization uri definition
    var authorizationUri = oauth2.authCode.authorizeURL({
        redirect_uri: url.resolve(webhookUrl, '/callback'),
        access_type: 'online',
        approval_prompt: 'auto',
        scope: 'trading',
        state: req.query.state
    });
    res.redirect(authorizationUri);
});

// Callback service parsing the authorization token and asking for the access token
app.get('/callback', function (req, res) {
    var code = req.query.code;
    var state = req.query.state;

    if (code && state) {
        oauth2.authCode.getToken({
            code: code,
            redirect_uri: url.resolve(webhookUrl, '/callback')
        }, saveToken);

        function saveToken(error, result) {
            if (error) {
                console.log('Access Token Error', error.message);
            }
            token = oauth2.accessToken.create(result);
            cTraderBot.saveToken(token, state);
            res.render('index');
        }
    } else {
        res.render('index');
    }
});
/*
app.get('/test', function(req, res) {
        console.log("******************");
        var data = fs.readFileSync("test/accounts.json");
        var jsonContent = JSON.parse(data);
        console.log(jsonContent);
        res.render('accounts', jsonContent)
});*/

// route: concise way to group all HTTP methods for a path
app.route('/')
    .get(function(req, res) {
        // console.log("you GET")
        res.render('index')
    })
    .post(function(req, res) {
        // send back to end req-res cycle
        res.json('okay, received\n');
        // robot handle as middleware for POST
        cTraderBot.handle(req, res)
    })
    .put(function(req, res) {
        res.send("you just called PUT\n")
    })


// finally, listen to the specific port for any calls
app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});
