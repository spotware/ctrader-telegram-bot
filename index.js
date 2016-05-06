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
// config
var config = require('./lib/config.js');
// telegram bot
var bot = require('./lib/bot');

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

var oauthRedirect = process.env.OAUTH_REDIRECT || "http://localhost:" + app.get('port');

// oAuth client initialization
var oauth2 = require('simple-oauth2')({
    clientID: config.connectApi.clientId,
    clientSecret: config.connectApi.clientSecret,
    site: 'https://connect.spotware.com',
    tokenPath: '/oauth/v2/token',
    authorizationPath: '/oauth/v2/auth'
});

// Initial page redirecting to Github
app.get('/auth', function (req, res) {
    // Authorization uri definition
    var authorizationUri = oauth2.authCode.authorizeURL({
        redirect_uri: url.resolve(oauthRedirect, '/callback'),
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
            redirect_uri: url.resolve(oauthRedirect, '/callback'),
        }, saveToken);
        
        function saveToken(error, result) {
            if (error) {
                console.log('Access Token Error', error.message);
            }
            token = oauth2.accessToken.create(result);
            bot.withContext(state, function (ctx) {
                console.log("Saving access token: " + token.token.access_token); 
                ctx.session.access_token = token.token.access_token;
                ctx.session.refresh_token = token.token.refresh_token;
                ctx.sendMessage('main.authok').then(function () {
                    return ctx.go('start');
                });
            });
            res.redirect('https://telegram.me/cTraderBot');
        }
    } else {
        res.render('index');
    }
});

// route: concise way to group all HTTP methods for a path
app.route('/')
    .get(function(req, res) {
        // console.log("you GET")
        res.render('index')
    })
    .post(function(req, res) {
        res.send("you just called POST\n")
        // robot handle as middleware for POST
        //bot.api._webHook._requestListener(req, res);
        bot.api._processUpdate(req.body);
    })
    .put(function(req, res) {
        res.send("you just called PUT\n")
    });
bot.listenUpdates();

// finally, listen to the specific port for any calls
app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});