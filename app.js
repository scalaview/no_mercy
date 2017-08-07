var express = require('express')
var config = require("./config")
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()
var urlencodedParser = bodyParser.urlencoded({ extended: false })
var async = require("async")
var flash = require('connect-flash');
var cookieParser = require('cookie-parser')
var session = require('express-session')
var _ = require('lodash')
var formidable = require('formidable')
var moment = require('moment')
var helpers = require("./helpers")
var app = express();
var admin = express();
var models  = require('./models');

app.set('port', process.env.PORT || config.port);
app.enable('verbose errors');
app.use(express.static(__dirname + '/public'));
connectAssets = require("connect-assets")({
  paths: [
    __dirname + '/public/javascript',
    __dirname + '/public/stylesheets',
    __dirname + '/node_modules',
    "assets"
  ],
  buildDir: "public/assets"
});
app.use(connectAssets);


var handlebars = require('express-handlebars').create({
  defaultLayout: 'main',
  helpers: helpers
});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.use(express.query());
app.use(cookieParser())
app.use(urlencodedParser)
app.use(jsonParser)
app.use(session({secret: config.session_secret, saveUninitialized: true, resave: true}))
app.use(flash());


app.use(function(req, res, next){
  var contentType = req.headers['content-type'] || ''
    , mime = contentType.split(';')[0];
  console.log("[" + helpers.strftime(new Date()) + "] content-type: " + mime)
  console.log("from: " + helpers.ip(req) + ", user-agent: " + req.headers['user-agent'], "contentType: " + mime)
  var excep = (mime == 'multipart/form-data' && req.method == "POST" && req.url == "/huawoconfirm")
  if (mime != 'text/plain' && mime != 'text/html' && !excep) {
    return next();
  }
  var data = "";
  req.on('data', function(chunk){ data += chunk})
  req.on('end', function(){
    if(data !== ''){
      try{
        req.rawBody = JSON.parse(data)
      }catch(e){
        req.rawBody = data
      }
    }
    next();
   })
})


app.use(function(req, res, next){
  var err = req.session.error,
      msg = req.session.notice,
      success = req.session.success;

  delete req.session.error;
  delete req.session.success;
  delete req.session.notice;

  if (err) res.locals.error = err;
  if (msg) res.locals.notice = msg;
  if (success) res.locals.success = success;

  next();
});


app.all("*", function(req, res, next) {
  console.log(req.method + " : " + req.url)
  next()
})

app.use('/admin', function (req, res, next) {
  res.locals.layout = 'admin';
  next();
});


// --------------- routers -----------------------
var apiV1  = require('./routers/api/v1');
for (var i = 0; i < apiV1.length; i++) {
  app.use('/api/v1', apiV1[i]);
};


var adminRouters  = require('./routers/admin');

app.use('/admin', admin);
for (var i = 0; i < adminRouters.length; i++) {
  app.use('/admin', adminRouters[i]);
};


var front  = require('./routers/front');
app.use(front);

// --------------- app -----------------------

app.get('/404', function(req, res, next){
  next();
});

app.get('/403', function(req, res, next){
  var err = new Error('not allowed!');
  err.status = 403;
  next(err);
});

app.get('/500', function(req, res, next){
  next(new Error('keyboard cat!'));
});

app.use(function(req, res, next){
  res.status(404);

  res.format({
    html: function(){
      res.render('404', { layout: false, url: req.url });
      return
    },

    json: function(){
      res.send({ error: 'Not found' });
      return
    },

    'default': function() {
      res.status(406).send('Not Acceptable');
      return
    }
  });

});

app.use(function(err, req, res, next){
  console.log(err)
  res.status(err.status || 500);
  res.render('500', { layout: false, error: err });
});


admin.use(function (req, res, next) {
  res.locals.info = req.flash('info');
  res.locals.err = req.flash('err');
  next();
});

var server = app.listen(app.get('port'), function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
  console.log('process path %s', process.env.PWD);
});