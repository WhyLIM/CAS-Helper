# CSM-Helper

一种基于~~量子学习~~ JavaScript Hook 的 CASMOOC（中科院在线教育网）学习工具。

## 📖 项目简介和探索

> 今年 CAS 要求在[中国科学院继续教育网](https://www.casmooc.cn/)上至少完成 50 学时的在线学习
>
> 通知 12 月 22 日才下发下来，但是 12 月 29 日前就要完成
>
> 7 天看 50 小时，一天得看 8 小时，还不能倍速，**这你受得了吗**
>
> <u>**真不是我不看，上面的很多课程还是不错的**</u>
>
> 只是临时搞这么一出实在是**太浪费我的科研时间了**
>
> 逼得我当场进行一个 ~~JS 逆向~~量子学习
>
> ![快速等待](D:\Study\Project\CSM-Helper\快速等待.png)

看了一下这个网站似乎是一个 Vue.js 写的单页面应用（SPA），经过 JS 逆向

本项目旨在探索单页面应用（SPA）在处理音视频学习状态时的前后端交互逻辑。逆向 `chunk-75412ec6.js` 等核心逻辑文件，本项目实现了对课程进度上报接口的动态拦截与模拟。

通过控制台发现，每次播放视频都会通过 `chunk-75412ec6.js` 打印出一个保存进度锁 id（`studyLockUUID`），

通过 Network 面板观察，发现在点击播放后会先发送一个 `submitLock` 请求，之后每 30s 触发一个 `submit` 请求上，报一次观看进度。我们将这个 `submit` 请求复制为 fetch 来看一下：

```javascript
fetch("https://www.casmooc.cn/server/api/study/submit", {
  "headers": {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-TW;q=0.6",
    "content-type": "application/json;charset=UTF-8",
    "sec-ch-ua": "\"Microsoft Edge\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-access-browser-info": "chrome 143.0.0.0",
    "x-access-device-mac": "",
    "x-access-device-name": "",
    "x-access-device-system": "Win10",
    "x-access-device-type": "WEB",
    "x-access-location-info": "",
    "x-access-origin": "aHR0cHM6Ly93d3cuY2FzbW9vYy5jbg==",
    "x-access-token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NjcxNDM5NDgsIm9wZXJhdG9ySWQiOiIxNTc4NjE2NDU4In0.HBMkHNsYGQEoJ_FOTROoaw-mSQXS5ydgnsMJYHC1O1I"
  },
  "body": "{\"belongCourseId\":\"1707033086097\",\"courseId\":\"1707033235027\",\"isRecordAudio\":0,\"lastLearnTime\":2220.982613,\"recordDuration\":\"30\",\"studyLockUUID\":\"418501F167214FD0BA9FC80644D1C346\"}",
  "method": "POST",
  "mode": "cors",
  "credentials": "omit"
});
```

可以发现 body 中有几个关键的参数：

- `belongCourseId`：课程 ID，用于标识课程。
- `courseId`：当前课程 ID，用于指定学习的具体课程。
- `lastLearnTime`：上次学习时间，单位秒。
- `recordDuration`：记录时长，单位秒。
- `studyLockUUID`：进度锁 ID，用于校验学习进度。

当然除此以外，还有一个 `x-access-token` 参数用于鉴权。

## ⚙️ 实现

那么，我们的目标就是获取这几个参数就可以了：

通过观察可以发现 `submitLock` 请求和 `submit` 请求的上传载荷中都包含了 `courseId` 与 `belongCourseId`，而 `studyLockUUID` 是动态生成的。

至于 Token，通过打印 `localStorage` 可以发现，其被存储在一个 `Continuing-Education-Web-Token` 键值对中。

技术方案如下：

### 参数提取

- **课程 ID**: 使用 XHR Hook 拦截 `XMLHttpRequest.send`，动态提取请求载荷中的 `courseId` 与 `belongCourseId`。
- **进度锁**: 重写 `console.log`，实时捕获系统内部生成的 `studyLockUUID`（进度锁）。
- **Token 获取**: 从浏览器 `localStorage.Continuing-Education-Web-Token` 中提取用户鉴权令牌。

### 进度上报

从之前的观察我们可以发现，默认的上报逻辑是，视频每播放 30s 触发一次上报，并且上报 30s 的观看进度，那么加速的方法也很简单：我们不改变每次上报的进度（30s），但改为每 3s 触发一次上报，那么实际上就是原视频的 10 倍速了。

### 加强

一个课程通常有 2~3 个子课程（少部分只有一节），每个子课程有自己的 `courseId`。在播放完一个子课程后，网站会自动切换到下一个子课程并更新 `courseId` 和 `studyLockUUID`。同样的，更新的 `studyLockUUID` 会被打印到控制台。

但是我们在实现之前的进度上报后会发现，视频的进度条仍然是按原速更新的，只是我们的观看进度被更新了。因此，我们可以在量子观看完成后，通过设置进度条跳转到视频接触前 0.1s 来模拟 `ended` 事件，触发播放器自动跳转下一章节。

此外，由于视频间的切换是一个无刷的过程，即视频自动切换章节后，网页不会刷新，只是视频的 `courseId` 与 `studyLockUUID` 会更新。我们需要更新这两个参数，才能继续上报进度。

## 🚀 使用方法

### 方式一：开发者工具（推荐）

1. 进入 CASMOOC 课程播放页面。
2. 按 `F12` 打开开发者工具，点击 `Console`（控制台）。
3. 复制 `main.js` 的代码并粘贴运行。
4. 点击播放视频，脚本将自动接管。

### 方式二：书签一键启动

1. 创建一个新的浏览器书签。

2. 在“网址/URL”栏中输入以下代码（建议自行对 `main.js` 进行混淆或压缩）：

   JavaScript

   ```
   javascript:(function(){ /* 将 main.js 代码压缩后放在此处 */ })();
   ```

## ⚠️ 免责声明

**此为本人为提高科研工作效率，无奈之下编写的自用脚本，本人不会进行任何形式的公开宣传**

**除完成任务，本人都已严肃观看，认真学习相关课程**

**本人不建议、不提倡且强烈反对、严厉谴责任何形式的不诚信行为**

**本人爱国爱院，爱岗敬业，践行社会主义核心价值观**

**本项目代码开源，仅用于 Web 逆向技术研究与 JavaScript 编程学习**

**使用本脚本可能产生的账号异常、学分失效或其它未知后果，均由使用者自行承担，本人不承担任何法律责任**

**请尊重版权，支持正版教育资源**

## 📜 许可证

本项目采用 [MIT License] 开源。
