const http = require('http')
const path = require('path')
const fse = require('fs-extra')
const multiparty = require('multiparty')

const server = http.createServer()
const UPLOAD_DIR = path.resolve(__dirname, '..', 'target') // 文件存储目录

const resolvePost = req => {
  return new Promise((resolve, reject) => {
    let chunk = ''
    req.on('data', data => {
      chunk += data
    })
    req.on("end", () => {
      resolve(JSON.parse(chunk))
    })
  })
}

const pipeStream = (path, writeStream) => {
  return new Promise((resolve, reject) => {
    const readStream = fse.createReadStream(path)
    readStream.on("end", () => {
      fse.unlinkSync(path)
      resolve()
    })
    readStream.pipe(writeStream)
  })
}

// 合并切片
const mergeFileChunk = async (filePath, filename, size) => {
  const chunkDir = path.resolve(UPLOAD_DIR, filename)
  const chunkPaths = await fse.readdir(chunkDir)
  // 根据切片下标进行排序
  // 否则直接读取目录的获得的顺序可能会错乱
  chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1])
  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        path.resolve(chunkDir, chunkPath),
        // 指定位置创建可写流
        fse.createWriteStream(filePath, {
          start: index * size,
          end: (index + 1) * size
        })
      )
    )
  )
  fse.rmdirSync(chunkDir)
}

server.on("request", async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === "OPTIONS") {
    res.status = 200
    res.end()
    return
  }

  if (req.url === "/merge") {
    const data = await resolvePost(req)
    const { filename, size } = data
    const filePath = path.resolve(UPLOAD_DIR, `${filename}`)
    await mergeFileChunk(filePath, filename.split('.')[0], size)
    res.end(
      JSON.stringify({
        code: 0,
        message: "file merged success"
      })
    )
  }

  const multipart = new multiparty.Form()
  multipart.parse(req, async (err, fields, files) => {
    if (err) return
    // files:  { chunk: [{ fieldName: 'chunk', originalFilename: 'blob', path: '/var/folders/25/f2c2w6k923z4y7tfjx98vvy40000gn/T/lgs_eL5ZEDm81uI35N_4oCVK', headers: [Object], size: 5242880 } ] }
    // fields: { hash: [ '周杰伦 稻香.mp4-1' ], filename: [ '周杰伦 稻香.mp4' ] }

    const [chunk] = files.chunk
    const [hash] = fields.hash
    const [filename] = fields.filename
    const chunkDir = path.resolve(UPLOAD_DIR, filename.split('.')[0])
    
    // 切片目录不存在，创建切片目录
    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir)
    }

    await fse.move(chunk.path, `${chunkDir}/${hash}`)
    res.end("received file chunk")
  })
})

server.listen(7400, () => console.log("正在监听 7400 端口"))
