exports.on = function (argument) {
  // body...
}


exports.strftime = function(dateTime, format){
  var result = moment()
  if(dateTime){
    result = moment(dateTime)
  }
  if( typeof format === 'string'){
    return result.format(format)
  }else{
    return result.format('YYYY-MM-DD HH:mm:ss')
  }
}

exports.randomInt = function(){
  Math.round((new Date().valueOf() * Math.random()))
}