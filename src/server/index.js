const express = require('express');
const path = require('path');

const PORT = 3008


let app = express();
app.use(function(req, res, next) {
  console.log(req.protocol + '://' + req.get('host') + req.originalUrl);
  next();
});

app.use('/', express.static(path.join(__dirname, '..', 'client')));

var server = app.listen(PORT);

console.log("server running @", PORT)
