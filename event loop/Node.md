## Node上的事件循环的实现
> 1. timers：执行setTimeout() 和 setInterval()中到期的callback。
> 2. I/O callbacks： 这个阶段执行几乎所有的回调。但是不包括close事件，定时器和setImmediate()的回调
> 3. idle, prepare：队列的移动，仅内部使用，可以不用理会
> 4. poll：最为重要的阶段，执行I/O callback，在适当的条件下会阻塞在这个阶段
> 5. check：执行 setImmediate 的callback
> 6. close callbacks：执行close事件的callback，例如socket.on("close",func)

##### poll阶段
v8引擎将js代码解析后传入libuv引擎后，循环首先进入poll阶段。poll阶段的执行逻辑如下： 先查看poll queue中是否有事件，有任务就按先进先出的顺序依次执行回调。 当queue为空时，会检查是否有setImmediate()的callback，如果有就进入check阶段执行这些callback。但同时也会检查是否有到期的timer，如果有，就把这些到期的timer的callback按照调用顺序放到timer queue中，之后循环会进入timer阶段执行queue中的 callback。 这两者的顺序是不固定的，受到代码运行的环境的影响。如果两者的queue都是空的，那么loop会在poll阶段停留，直到有一个i/o事件返回，循环会进入i/o callback阶段并立即执行这个事件的callback。

值得注意的是，poll阶段在执行poll queue 中的回调时实际上不会无限的执行下去。有两种情况poll阶段会终止执行poll queue中的下一个回调：1.所有回调执行完毕。2.执行数超过了node的限制。

##### process.nextTick()
尽管没有提及，但是实际上node中存在着一个特殊的队列，即nextTick queue。这个队列中的回调执行虽然没有被表示为一个阶段，当时这些事件却会在每一个阶段执行完毕准备进入下一个阶段时优先执行。当事件循环准备进入下一个阶段之前，会先检查nextTick queue中是否有任务，如果有，那么会先清空这个队列。与执行poll queue中的任务不同的是，这个操作在队列清空前是不会停止的。这也就意味着，错误的使用process.nextTick()方法会导致node进入一个死循环。。直到内存泄漏。

![image](https://image-static.segmentfault.com/690/666/690666428-5ab0a22b5cbca_articlex)

不同于浏览器的是，在每个阶段完成后，microTask队列就会被执行，而不是MacroTask任务完成后。这就导致了同样的代码在不同的上下文环境下会出现不同的结果。我们在下文中会探讨。

另外需要注意的是，如果在timers阶段执行时创建了setImmediate则会在此轮循环的check阶段执行，如果在timers阶段创建了setTimeout，由于timers已取出完毕，则会进入下轮循环，check阶段创建timers任务同理。

```js
setTimeout(()=>{
    console.log('timer1')

    Promise.resolve().then(function() {
        console.log('promise1')
    })
}, 0)

setTimeout(()=>{
    console.log('timer2')

    Promise.resolve().then(function() {
        console.log('promise2')
    })
}, 0)



// 浏览器输出：
// time1
// promise1
// time2
// promise2

// Node输出：
// time1
// time2
// promise1
// promise2
```

#### 浏览器执行
![image](https://upload-images.jianshu.io/upload_images/2707400-2968b449856af912.gif?imageMogr2/auto-orient/strip%7CimageView2/2/w/800/format/webp)

#### node 执行
![image](https://upload-images.jianshu.io/upload_images/2707400-781ed56509d40758.gif?imageMogr2/auto-orient/)

### setTimeout()和setImmediate()
**setTimeout()**: 是定义一个回调，并且希望这个回调在我们所指定的时间间隔后第一时间去执行。注意这个“第一时间执行”，这意味着，受到操作系统和当前执行任务的诸多影响，该回调并不会在我们预期的时间间隔后精准的执行。执行的时间存在一定的延迟和误差，这是不可避免的。node会在可以执行timer回调的第一时间去执行你所设定的任务。

**setImmediate()**: 从意义上将是立刻执行的意思，但是实际上它却是在一个固定的阶段才会执行回调，即poll阶段之后。

验证同样的代码在不同的上下文环境下会出现不同的结果：
```js
setImmediate(() => {
  console.log('timer1')

  Promise.resolve().then(function () {
    console.log('promise1')
  })
})

setTimeout(() => {
  console.log('timer2')

  Promise.resolve().then(function () {
    console.log('promise2')
  })
}, 0)

//Node输出：
// timer1               timer2
// promise1    或者     promise2
// timer2               timer1
// promise2             promise1
```

按理说setTimeout(fn,0)应该比setImmediate(fn)快，应该只有第二种结果，为什么会出现两种结果呢？
这是因为Node 做不到0毫秒，最少也需要1毫秒。实际执行的时候，进入事件循环以后，有可能到了[1毫秒](https://nodejs.org/api/timers.html#timers_settimeout_callback_delay_args)，也可能还没到1毫秒，取决于系统当时的状况。如果没到1毫秒，那么 timers 阶段就会跳过，进入 check 阶段，先执行setImmediate的回调函数。

但是，在一种情况下可以准确判断两个方法回调的执行顺序，那就是在一个I/O事件的回调中。下面这段代码的顺序永远是固定的：
```js
const fs = require('fs');

fs.readFile('test.js', () => {
  setTimeout(() => console.log(1));
  setImmediate(() => console.log(2));
});

// 2 -> 1
```
上面代码会先进入 I/O callbacks 阶段，然后是 check 阶段，最后才是 timers 阶段。因此，setImmediate才会早于setTimeout执行。

### 不同异步任务执行的快慢
```js
setTimeout(() => console.log(1));
setImmediate(() => console.log(2));

Promise.resolve().then(() => console.log(3));
process.nextTick(() => console.log(4));


// 输出结果：4 3 1 2或者4 3 2 1
```
因为我们上文说过microTask会优于macroTask运行，所以先输出下面两个，而在Node中process.nextTick比Promise更加优先，所以4在3前。而根据我们之前所说的Node没有绝对意义上的0ms，所以1,2的顺序不固定。

###  MicroTask队列(微任务)与MacroTask队列(宏任务)
```js
   setTimeout(function () {
       console.log(1);
   },0);
   console.log(2);
   process.nextTick(() => {
       console.log(3);
   });
   new Promise(function (resolve, rejected) {
       console.log(4);
       resolve()
   }).then(res=>{
       console.log(5);
   })
   setImmediate(function () {
       console.log(6)
   })
   console.log('end');

  // Node输出：
  // 2 4 end 3 5 1 6
```
Promise的代码是同步代码，then和catch才是异步的，所以4要同步输出，然后Promise的then位于microTask中，优于其他位于macroTask队列中的任务，所以5会优于1,6输出，而Timer优于Check阶段,所以1,6。

### [阮一峰老师node事件循环例子](http://www.ruanyifeng.com/blog/2014/10/event-loop.html)

```js
process.nextTick(function A() {
  console.log(1);
  process.nextTick(function B(){console.log(2);});
});

setTimeout(function timeout() {
  console.log('TIMEOUT FIRED');
}, 0)
// 1
// 2
// TIMEOUT FIRED
```
上面代码中，由于process.nextTick方法指定的回调函数，总是在当前"执行栈"的尾部触发，所以不仅函数A比setTimeout指定的回调函数timeout先执行，而且函数B也比timeout先执行。这说明，如果有多个process.nextTick语句（不管它们是否嵌套），将全部在当前"执行栈"执行。

现在，再看setImmediate。
```js
setImmediate(function A() {
  console.log(1);
  setImmediate(function B(){console.log(2);});
});

setTimeout(function timeout() {
  console.log('TIMEOUT FIRED');
}, 0);
```
上面代码中，setImmediate与setTimeout(fn,0)各自添加了一个回调函数A和timeout，都是在下一次Event Loop触发。那么，哪个回调函数先执行呢？答案是不确定。运行结果可能是1--TIMEOUT FIRED--2，也可能是TIMEOUT FIRED--1--2。

令人困惑的是，Node.js文档中称，setImmediate指定的回调函数，总是排在setTimeout前面。实际上，这种情况只发生在递归调用的时候。

```js
setImmediate(function (){
  setImmediate(function A() {
    console.log(1);
    setImmediate(function B(){console.log(2);});
  });

  setTimeout(function timeout() {
    console.log('TIMEOUT FIRED');
  }, 0);
});
// 1
// TIMEOUT FIRED
// 2
```
上面代码中，setImmediate和setTimeout被封装在一个setImmediate里面，它的运行结果总是1--TIMEOUT FIRED--2，这时函数A一定在timeout前面触发。至于2排在TIMEOUT FIRED的后面（即函数B在timeout后面触发），是因为setImmediate总是将事件注册到下一轮Event Loop，所以函数A和timeout是在同一轮Loop执行，而函数B在下一轮Loop执行。

我们由此得到了process.nextTick和setImmediate的一个重要区别：多个process.nextTick语句总是在当前"执行栈"一次执行完，多个setImmediate可能则需要多次loop才能执行完。事实上，这正是Node.js 10.0版添加setImmediate方法的原因，否则像下面这样的递归调用process.nextTick，将会没完没了，主线程根本不会去读取"事件队列"！
```js
process.nextTick(function foo() {
  process.nextTick(foo);
})
```
事实上，现在要是你写出递归的process.nextTick，Node.js会抛出一个警告，要求你改成setImmediate。
