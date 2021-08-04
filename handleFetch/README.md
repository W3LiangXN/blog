# 图片上传问题及其解决方式
## 背景
  开发一个AI纽约时报上传系统, 提供给AI部门上传图片, 需要把原图上传到OSS上以及把原图经过加水印处理后上传到七牛云。页面提供一个选择图片的按钮, 供用户选择图片。一开始的做法是，图片一张一张的处理，处理完第一张才去执行第二张图片的任务，但是这种方式明显会很慢，假如上一张图片处理很慢，就会导致第二张停顿很久。所以后面改成多图片并行上传的方式，但是也遇到了问题，就是请求并发量太大，导致页面卡顿，容易造成请求失败。所以最后的处理方式时，限制请求并发量，设计一个请求队列，给定一个阈值， 假如当前请求数量超过这个阈值，则让该请求去排队，一步一步把请求队列执行完成。

  下面我就模拟了一下场景来说明和解决问题。

## 搭建服务
首先我使用 node.js 搭建一个服务

```js
let http = require('http')

let server = http.createServer()

server.on('request', function (req, res) {
  const url = req.url

  // 解决跨域问题
  res.setHeader('Access-Control-Allow-Origin', '*')

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
``` 
代码比较简单, 就是使用 http 模块, 搭建了一个7300端口的服务, 并监听了 /api/mock 请求接口。

## 模拟图片上传
### html结构
```html
<input id="inputRef" type="number" value="0" placeholder="输入请求数量" />
<button id='sendBtn'>发送</button>
<ul class="task-list" id="taskList"></ul>
```

一个 input 标签接收输入的数值, 根据这个数值来模拟请求的数量, 比如输入 100, 点击发送按钮. 则表示发送 100 条请求, ul 标签则是展示每条请求的状态。

### css样式
简单的写了些样式
```css
.task-list {
  padding: 0;
}
.task-list .task-item {
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  list-style: none;
  padding:  0 10px;
  margin-bottom: 10px;
}
```

### javascript 代码

```js
const btnDom = document.querySelector('#sendBtn')
const inputDom = document.querySelector('#inputRef')
const taskListDom = document.querySelector('#taskList')
let taskItemList = document.querySelectorAll('.task-item')

// 发送请求, 携带上一个 1~3的随机数, 接口就会根据这个随机数来模拟响应速度
const fetchApi = () => {
  return new Promise((resolve, reject) => {
    const randomTime = Math.ceil(Math.random() * 3) // 生成 1~3 的随机数
    fetch(`http://localhost:7300/api/mock?randomTime=${randomTime}`, {
      method: 'GET'
    })
      .then(res => res.json())
      .then(result => {
        resolve(result)
      })
      .catch(err => reject('error'))
  })
}

// 处理任务完成时事件
const handleTaskComplete = (id) => {
  const itemArr = Array.from(taskItemList)
  const curItem = itemArr.find(item => item.dataset.taskIndex === id)
  if (curItem) {
    curItem.style.background = '#52C41A'
  }
}

// 点击发送
const handleSend = () => {
  const fetchNumber = inputDom.value
  if (!fetchNumber || fetchNumber === 0) {
    alert('请输入数量')
    return
  }

  let strHtml = ''
  for (let i = 1; i <= fetchNumber; i++) {
    strHtml += `<li class="task-item" style="background: #cecece" data-task-index='${i}'><span class="name">task ${i}</span></li>`
  }
  
  taskListDom.innerHTML = strHtml
  taskItemList = document.querySelectorAll('.task-item')

  const taskHandle = () => {
    // doing something
  }

  taskHandle()
}

btnDom.addEventListener('click', handleSend)
```

从代码我们就可以看出, 每当我们输入数量后, 点击发送, 就会创建相同数量的 li 标签添加到 ul 内, 然后执行 taskHandle 方法。

#### 方式一
首先我们就来实现方式一, 接口一个个去处理。 把 taskHandle 改一下
```js
const taskHandle = async () => {
  for (let j = 1; j <= fetchNumber; j++) {
    await fetchApi() // 用 async await 来使接口顺序的去执行
    handleTaskComplete(`${j}`)
  }
}
```

点开控制台, 查看network, 我们就会发现, 接口一个一个的去执行, 当上一个请求响应速度跟慢, 就会阻塞下一个请求, 导致任务全部完成的时间很慢。

#### 方式二
由于方式一的阻塞问题比较严重, 我们使用方式二, 不用请求一个个的等待

```js
const taskHandle = async () => {
  for (let j = 1; j <= fetchNumber; j++) {
    fetchApi()
      .then(res => {
        handleTaskComplete(`${j}`)
      })
  }
}
```

从代码可以看出, 当我们有20个请求的时候, 就会有20个请求并行的发送出去, 这时候点开控制台查看network, 我们就可以看出, 并发量太大的问题。这里是比较简单的逻辑, 只是一个请求发送, 服务响应的过程。所以当我们发送大量的请求的时候，页面不会卡顿，但是当我们遇到复杂的逻辑时候，就会感到页面明显的卡顿，所以说这种方式也存在明显的问题。

#### 方式三
通过方式一和方式二的实现, 我们都发现有明显的问题, 所以我们就使用方式三, 就是给定一个阈值, 假如当前处理的接口数量超过这个阈值的时候, 就会把它加到队列中去排队, 这样就可以即避免了方式一严重的阻塞问题, 也规避了方式二并发量大的问题。

首先实现一个队列类
```js
class LimitPromise {
  constructor (max) {
    // 异步任务“并发”上限
    this._max = max
    // 当前正在执行的任务数量
    this._count = 0
    // 等待执行的任务队列
    this._taskQueue = []
  }

  /**
   * 调用器，将异步任务函数和它的参数传入
   * @param caller 异步任务函数，它必须是async函数或者返回Promise的函数
   * @param cb 成功回调函数
   * @param args 异步任务函数的参数列表
   * @returns {Promise<unknown>} 返回一个新的Promise
   */
  call (caller, cb, ...args) {
    return new Promise((resolve, reject) => {
      const task = this._createTask(caller, args, () => { cb(); return resolve }, reject)
      if (this._count >= this._max) {
        this._taskQueue.push(task)
      } else {
        task()
      }
    })
  }

  /**
   * 创建一个任务
   * @param caller 实际执行的函数
   * @param args 执行函数的参数
   * @param resolve
   * @param reject
   * @returns {Function} 返回一个任务函数
   * @private
   */
  _createTask (caller, args, resolve, reject) {
    return () => {
      // 实际上是在这里调用了异步任务，并将异步任务的返回（resolve和reject）抛给了上层
      caller(...args)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          // 任务队列的消费区，利用 Promise 的 finally 方法，在异步任务结束后，取出下一个任务执行
          this._count--
          if (this._taskQueue.length) {
            let task = this._taskQueue.shift()
            task()
          } else {
            // 任务队列已清空
          }
        })
      this._count++
    }
  }
}

export default LimitPromise
```

把我们的代码和script标签改下

```js
// <script type="module"></script> // 把 script 标签 type="module"

import LimitPromise from './tools.js'

const MAX = 3 // 阈值为3
const limitPromise = new LimitPromise(MAX)

const taskHandle = async () => {
  for (let j = 1; j <= fetchNumber; j++) {
    limitPromise.call(fetchApi, () => handleTaskComplete(`${j}`))
  }
}

```

执行代码, 查看network, 就会发现这种方式比一和二更合理, 更符合我们的需求。当接口数量超过3个时, 不会再有接口去请求, 只有当这三个接口的某个完成时, 才会有新的接口去请求。
