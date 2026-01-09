// renderer/renderer.js
// 假设 face-api.js 是通过 index.html 的 CDN 注入到全局（window.faceapi）
(function () {
  // 等待库加载完成
  function waitForLibraries() {
    return new Promise((resolve) => {
      if (window.tf && window.faceapi) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (window.tf && window.faceapi) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        // 超时保护
        setTimeout(() => {
          clearInterval(checkInterval);
          if (window.tf && window.faceapi) {
            resolve();
          } else {
            console.error('库加载超时：tf=' + !!window.tf + ', faceapi=' + !!window.faceapi);
          }
        }, 5000);
      }
    });
  }

  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const ctx = overlay.getContext('2d');

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const intervalInput = document.getElementById('interval');
  const peopleThresholdInput = document.getElementById('peopleThreshold');
  const minFaceRatioInput = document.getElementById('minFaceRatio');
  const statusEl = document.getElementById('status');
  const peopleCountEl = document.getElementById('peopleCount');
  const rawCountEl = document.getElementById('rawCount');
  const debugLogEl = document.getElementById('debugLog');

  let running = false;
  let modelLoaded = false;
  let videoReady = false;

  // 防误报参数
  let consecutiveCount = 0;
  const consecutiveThreshold = 1;
  let lastAlertTime = 0;
  const alertCooldown = 3000; // ms
  
  // 安全页面状态跟踪
  let safeWindowOpen = false;
  let safeCloseCount = 0;
  let lastCloseTime = 0;
  const closeCooldown = 3000; // ms

  // 简单日志
  function debugLog(msg) {
    const t = new Date().toISOString().slice(11,23);
    debugLogEl.textContent = `[${t}] ${msg}\n` + debugLogEl.textContent;
  }

  function logStatus(s) {
    statusEl.innerText = '状态：' + s;
    debugLog(s);
  }

  // 初始化摄像头（请求小分辨率）
  async function setupCamera() {
    try {
      logStatus('请求摄像头 160x120...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 160, height: 120 },
        audio: false
      });
      video.srcObject = stream;

      // 等待 metadata/loadeddata 以确保 videoWidth/videoHeight 可用
      await new Promise((resolve, reject) => {
        const onLoaded = () => {
          video.removeEventListener('loadeddata', onLoaded);
          // 若 videoWidth/Height 仍为 0，等待短时间
          setTimeout(() => resolve(), 50);
        };
        video.addEventListener('loadeddata', onLoaded);
        // 超时保护
        setTimeout(() => {
          // 如果还没触发 loadeddata，仍 resolve（后续有保护）
          resolve();
        }, 2000);
      });

      // 同步 canvas 尺寸（如果为 0，就使用 160/120 默认值）
      overlay.width = video.videoWidth || 160;
      overlay.height = video.videoHeight || 120;
      videoReady = true;
      logStatus(`摄像头已就绪: ${overlay.width}x${overlay.height}`);
      return true;
    } catch (e) {
      console.error('无法打开摄像头', e);
      logStatus('无法打开摄像头: ' + e.message);
      return false;
    }
  }

  // 加载 face-api 模型（必须）
  async function loadModel() {
    try {
      logStatus('开始加载 TinyFaceDetector 模型（从 ../face-models）...');
      // 这里必须保证你项目根目录存在 face-models/tiny_face_detector_model-weights_manifest.json 和 shard
      await faceapi.nets.tinyFaceDetector.loadFromUri('../face-models');
      modelLoaded = true;
      logStatus('模型加载成功');
    } catch (e) {
      modelLoaded = false;
      console.error('加载模型失败', e);
      logStatus('加载模型失败: ' + (e.message || e));
      // 抛出错误让上层知道（start 会捕获）
      throw e;
    }
  }


  // 主检测循环：只有在 running && modelLoaded && videoReady 时才会循环
  async function detectLoop() {
    if (!running) {
      debugLog('detectLoop 停止（running=false）');
      return;
    }
    if (!modelLoaded) {
      debugLog('detectLoop 等待：模型未加载');
      setTimeout(detectLoop, 500);
      return;
    }
    if (!videoReady) {
      debugLog('detectLoop 等待：视频未就绪');
      setTimeout(detectLoop, 500);
      return;
    }

    const interval = parseInt(intervalInput.value) || 500;
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 128,
      scoreThreshold: 0.5
    });

    try {
      // 确保 video 元素已加载并正在播放
      if (video.readyState < 2) {
        debugLog('视频未就绪，跳过本次检测');
        setTimeout(detectLoop, interval);
        return;
      }

      const t0 = performance.now();
      // 使用 video 元素进行检测（检测整个画面）
      const detections = await faceapi.detectAllFaces(video, options);
      const t1 = performance.now();
      debugLog(`detectAllFaces 返回 ${detections.length} 个人脸 (耗时 ${(t1-t0).toFixed(1)}ms)`);

      // 清画布
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // 过滤小人脸
      const minFaceRatio = (parseFloat(minFaceRatioInput.value) || 8) / 100;
      const validFaces = detections.filter(d => {
        // 保护：某些返回可能没有 box
        if (!d.box || typeof d.box.height !== 'number') {
          debugLog('检测到无效的人脸数据（缺少 box）');
          return false;
        }
        // 如果 overlay.height 为 0，不做过滤（避免除 0）
        if (!overlay.height) return true;
        const faceRatio = d.box.height / overlay.height;
        const isValid = faceRatio >= minFaceRatio;
        if (!isValid) {
          debugLog(`人脸太小被过滤: height=${d.box.height.toFixed(1)}, ratio=${(faceRatio*100).toFixed(1)}%`);
        }
        return isValid;
      });

      // 绘制框（检测整个画面）
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1.2;
      validFaces.forEach(d => {
        if (d.box) ctx.strokeRect(d.box.x, d.box.y, d.box.width, d.box.height);
      });

      // 更新人数显示： raw = detections.length, filtered = validFaces.length
      rawCountEl.innerText = detections.length;
      peopleCountEl.innerText = validFaces.length;
      
      debugLog(`有效人脸数: ${validFaces.length} (原始: ${detections.length})`);

      // 判定画面是否有人（检测整个画面）
      const danger = validFaces.length > 0;

      // 连续帧计数（用于打开安全页面）
      if (danger) {
        consecutiveCount++;
      } else {
        consecutiveCount = 0;
      }

      // 连续帧计数（用于关闭安全页面）
      if (!danger) {
        safeCloseCount++;
      } else {
        safeCloseCount = 0;
      }

      debugLog(`validFaces=${validFaces.length} danger=${danger} consecutive=${consecutiveCount} safeCloseCount=${safeCloseCount}`);

      // 如果画面有人（连续帧达到阈值）并且冷却期结束时才切屏
      if (consecutiveCount >= consecutiveThreshold && (Date.now() - lastAlertTime) > alertCooldown) {
        lastAlertTime = Date.now();
        consecutiveCount = 0;
        safeWindowOpen = true;
        debugLog('触发切屏：发送 showSafe IPC');
        // 最终切屏调用（通过 preload 暴露的 API）
        try {
          if (window.moyuAPI && typeof window.moyuAPI.showSafe === 'function') {
            window.moyuAPI.showSafe();
            logStatus('检测到他人 -> 已切屏（无声）');
          } else {
            logStatus('检测到他人（本地 API 未暴露）');
          }
        } catch (e) {
          console.error('调用 showSafe 失败', e);
          logStatus('调用 showSafe 失败: ' + e.message);
        }
      } 
      // 如果画面人数少于阈值（连续帧达到阈值）并且冷却期结束，关闭安全页面
      else if (safeCloseCount >= consecutiveThreshold && safeWindowOpen && (Date.now() - lastCloseTime) > closeCooldown) {
        lastCloseTime = Date.now();
        safeCloseCount = 0;
        safeWindowOpen = false;
        debugLog('触发关闭安全页面：发送 hideSafe IPC');
        try {
          if (window.moyuAPI && typeof window.moyuAPI.hideSafe === 'function') {
            window.moyuAPI.hideSafe();
            logStatus('画面无人 -> 已关闭安全页面');
          } else {
            logStatus('画面无人（本地 API 未暴露）');
          }
        } catch (e) {
          console.error('调用 hideSafe 失败', e);
          logStatus('调用 hideSafe 失败: ' + e.message);
        }
      } else {
        if (!danger) logStatus('正常，未检测到他人');
      }
    } catch (e) {
      console.error('detectLoop 错误', e);
      logStatus('检测错误: ' + (e.message || e));
    }

    setTimeout(detectLoop, interval);
  }

  // start 逻辑：保证先摄像头就绪，再加载模型，再开始循环
  startBtn.addEventListener('click', async () => {
    if (running) return;
    
    // 确保库已加载
    try {
      await waitForLibraries();
      if (!window.tf || !window.faceapi) {
        logStatus('库未加载完成，请刷新页面重试');
        return;
      }
    } catch (e) {
      logStatus('库加载失败: ' + e.message);
      return;
    }
    
    debugLog('开始点击：setupCamera -> loadModel -> start loop');
    const ok = await setupCamera();
    if (!ok) {
      logStatus('摄像头初始化失败，无法启动检测');
      return;
    }

    // 仅当模型未加载时才加载
    if (!modelLoaded) {
      try {
        await loadModel();
      } catch (e) {
        logStatus('模型加载失败，停止启动');
        return;
      }
    }

    // 双重确认 videoReady 与 modelLoaded
    if (!videoReady || !modelLoaded) {
      logStatus('启动失败：视频或模型未就绪');
      return;
    }

    running = true;
    logStatus('开始检测...');
    detectLoop();
  });

  stopBtn.addEventListener('click', () => {
    running = false;
    logStatus('已停止检测');
  });

  // 页面加载后等待库加载并输出环境信息
  window.addEventListener('load', async () => {
    debugLog('页面加载完成，等待库加载...');
    try {
      await waitForLibraries();
      debugLog('库加载完成：tf=' + (window.tf ? 'OK' : 'MISSING') + ', faceapi=' + (window.faceapi ? 'OK' : 'MISSING'));
      if (window.tf) {
        debugLog('TensorFlow.js 版本: ' + (window.tf.version || 'unknown'));
      }
    } catch (e) {
      console.error('等待库加载失败', e);
      debugLog('等待库加载失败: ' + e.message);
    }
  });

})();
