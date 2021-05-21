## index
```js
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
```

## bigFileUpload

```js
// 逐个顺序的去合并
const writeStream = fse.createWriteStream(filePath)
for (let i = 0; i < chunkPaths.length; i++) {
  await new Promise((resolve, reject) => {
    const readStream = fse.createReadStream(path.resolve(chunkDir, chunkPaths[i]))
    readStream.on("end", () => {
      // 删除临时存储的切片文件
      fse.unlinkSync(path.resolve(chunkDir, chunkPaths[i]))
      resolve()
    })
    readStream.pipe(writeStream, { end: false })
    
  })
  if (i >= chunkPaths.length - 1) {
    writeStream.end("done")
  }
}
```