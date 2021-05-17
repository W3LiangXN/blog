const http = require('http')
const fs = require('fs')
const path = require('path')

let server = http.createServer()

server.on('request', function (req, res) {
  const url = req.url
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (url === '/') {
    fs.readFile(path.resolve(__dirname, '../index.html'), "utf-8", function (err, data) {
      if (err) {
        res.statusCode = 404;
        res.setHeader("Content-Type","text/plain")
        res.end("Not Found!")
        return
      }
      res.setHeader("Content-Type", "text/html")
      res.statusCode = 200
      res.end(data)
    })
  }

  if (url === '/limitPromise.js') {
    fs.readFile(path.resolve(__dirname, '../limitPromise.js'), "utf-8", function (err, data) {
      if (err) {
        res.statusCode = 404;
        res.setHeader("Content-Type","text/plain")
        res.end("Not Found!")
        return
      }
      res.setHeader("Content-Type", "text/javascript")
      res.statusCode = 200
      res.end(data)
    })
  }

  if (url.includes('/api/mock')) {
    const number = url.split('=')[1]
    const resObj = {
      msg: `randomTime 为: ${number}`
    }
    setTimeout(() => {
      res.end(JSON.stringify(resObj))
    }, 1000 * number)
  }
})

server.listen(7300, function() {
  console.log('服务器启动成功了')
})
