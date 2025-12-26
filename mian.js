(function() {
    const getActiveToken = () => localStorage.getItem("Continuing-Education-Web-Token")?.replace(/"/g, '').trim();
    
    window.COURSE_DATA = { bId: null, cId: null, uuid: null };
    window.HACK_TIMER = null;

    console.log("%c🚀 程序启动，Token 已自动识别。", "color: #e83e8c; font-weight: bold; font-size: 14px;");

    // 1. 动态拦截 ID
    const _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(data) {
        if (data && typeof data === 'string' && data.includes('courseId')) {
            try {
                const payload = JSON.parse(data);
                if (payload.courseId && payload.courseId !== window.COURSE_DATA.cId) {
                    window.COURSE_DATA.bId = payload.belongCourseId;
                    window.COURSE_DATA.cId = payload.courseId;
                    if (window.HACK_TIMER) {
                        clearInterval(window.HACK_TIMER);
                        window.HACK_TIMER = null;
                    }
                    console.log(`%c♻️ 切换至新章节: ${window.COURSE_DATA.cId}`, "color: #fd7e14;");
                }
            } catch (e) {}
        }
        return _send.apply(this, arguments);
    };

    // 2. 劫持日志获取 UUID 并激活挂机
    const originalLog = console.log;
    console.log = function(...args) {
        const msg = args.join(' ');
        if (msg.includes("更新了保存进度锁 id:")) {
            const newUuid = msg.split("id:")[1].trim();
            if (newUuid !== window.COURSE_DATA.uuid || !window.HACK_TIMER) {
                window.COURSE_DATA.uuid = newUuid;
                console.log("%c[激活] 捕获 UUID:", "color: #28a745;", newUuid);
                
                // 延迟 2 秒启动，确保播放器加载完成
                setTimeout(startHacking, 2000);
            }
        }
        originalLog.apply(console, args);
    };

    // 3. 挂机上报逻辑
    function startHacking() {
        if (window.HACK_TIMER) return;

        const video = document.querySelector('video');
        if (!video) {
            console.warn("未找到视频对象，正在重试...");
            setTimeout(startHacking, 2000);
            return;
        }

        const token = getActiveToken();
        if (!token) {
            console.error("❌ 无法获取 Token，请确认已登录。");
            return;
        }

        const total = Math.floor(video.duration || 0);
        let curr = Math.floor(video.currentTime || 0);

        console.log(`%c▶️ 挂机开始 | 目标: ${total}s | Token: ${token.slice(0,10)}...`, "color: #007bff;");

        window.HACK_TIMER = setInterval(async () => {
            curr += 30;
            
            if (curr >= total && total > 0) {
                curr = total;
                clearInterval(window.HACK_TIMER);
                window.HACK_TIMER = null;
                console.log("%c🏁 章节已看完，执行自动跳转...", "color: #28a745; font-weight: bold;");
                jumpToNext(video);
            }

            const payload = {
                "belongCourseId": String(window.COURSE_DATA.bId),
                "courseId": String(window.COURSE_DATA.cId),
                "isRecordAudio": 0,
                "lastLearnTime": curr,
                "recordDuration": "30",
                "studyLockUUID": window.COURSE_DATA.uuid
            };

            try {
                const res = await fetch("https://www.casmooc.cn/server/api/study/submit", {
                    method: "POST",
                    headers: { 
                        "content-type": "application/json;charset=UTF-8", 
                        "x-access-token": token,
                        "x-access-origin": "aHR0cHM6Ly93d3cuY2FzbW9vYy5jbg==",
                        "x-access-device-type": "WEB"
                    },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                console.log(`[${Math.round((curr/total)*100)}%] ${curr}/${total}s | ${result.message}`);
            } catch (e) { console.error("上报异常"); }
        }, 3000);
    }

    // 4. 跳转函数
    function jumpToNext(video) {
        try {
            video.currentTime = video.duration - 0.1;
            video.play().then(() => {
                video.dispatchEvent(new Event('ended'));
            }).catch(() => {
                video.dispatchEvent(new Event('ended'));
            });
        } catch (err) { console.error("跳转执行失败"); }
    }
})();
