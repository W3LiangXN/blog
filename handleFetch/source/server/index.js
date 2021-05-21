const http = require('http')
const fs = require('fs')
const path = require('path')

let server = http.createServer()

server.on('request', function (req, res) {
  const url = req.url
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (url.includes('/api/mock')) {
    const number = url.split('=')[1]
    const resObj = {
      msg: `randomTime is: ${number}`
    }
    setTimeout(() => {
      res.end(JSON.stringify(resObj))
    }, 1000 * number)
  }
})

server.listen(7300, function() {
  console.log('服务器启动成功了')
})
