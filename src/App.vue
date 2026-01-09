<script setup>
import { ref, onMounted } from 'vue'
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'

// 响应式数据
const interval = ref(500)
const peopleThreshold = ref(2)
const minScore = ref(50) // 置信度阈值
const status = ref('状态：未启动')
const peopleCount = ref(0)
const rawCount = ref(0)
const debugLog = ref('')

// 引用
const video = ref(null)
const overlay = ref(null)
const debugLogEl = ref(null)
let ctx = null
let model = null

// 内部状态
let running = false
let modelLoaded = false
let videoReady = false

// 防误报参数
let consecutiveCount = 0
const consecutiveThreshold = 2
let lastAlertTime = 0
const alertCooldown = 3000 // ms

// 安全页面状态跟踪
let safeWindowOpen = false
let safeCloseCount = 0
let lastCloseTime = 0
const closeCooldown = 3000 // ms

// 简单日志
function log(msg) {
  const t = new Date().toISOString().slice(11,23)
  debugLog.value = `[${t}] ${msg}\n` + debugLog.value
}

function logStatus(s) {
  status.value = '状态：' + s
  log(s)
}

// 初始化摄像头（请求小分辨率）
async function setupCamera() {
  try {
    logStatus('请求摄像头 160x120...')
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 160, height: 120 },
      audio: false
    })
    video.value.srcObject = stream

    // 等待 metadata/loadeddata 以确保 videoWidth/videoHeight 可用
    await new Promise((resolve) => {
      const onLoaded = () => {
        video.value.removeEventListener('loadeddata', onLoaded)
        setTimeout(() => resolve(), 50)
      }
      video.value.addEventListener('loadeddata', onLoaded)
      // 超时保护
      setTimeout(() => {
        resolve()
      }, 2000)
    })

    // 同步 canvas 尺寸
    overlay.value.width = video.value.videoWidth || 160
    overlay.value.height = video.value.videoHeight || 120
    videoReady = true
    logStatus(`摄像头已就绪: ${overlay.value.width}x${overlay.value.height}`)
    return true
  } catch (e) {
    console.error('无法打开摄像头', e)
    logStatus('无法打开摄像头: ' + e.message)
    return false
  }
}

// 加载 COCO-SSD 模型
async function loadModel() {
  try {
    logStatus('开始加载 COCO-SSD 模型...')
    await tf.ready()
    // 加载模型，默认使用 'lite_mobilenet_v2'，比较轻量
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
    modelLoaded = true
    logStatus('模型加载成功')
  } catch (e) {
    modelLoaded = false
    console.error('加载模型失败', e)
    logStatus('加载模型失败: ' + (e.message || e))
    throw e
  }
}

// 主检测循环
async function detectLoop() {
  if (!running) {
    log('detectLoop 停止（running=false）')
    return
  }
  if (!modelLoaded) {
    log('detectLoop 等待：模型未加载')
    setTimeout(detectLoop, 500)
    return
  }
  if (!videoReady) {
    log('detectLoop 等待：视频未就绪')
    setTimeout(detectLoop, 500)
    return
  }

  const intervalVal = parseInt(interval.value) || 500
  
  try {
    if (video.value.readyState < 2) {
      log('视频未就绪，跳过本次检测')
      setTimeout(detectLoop, intervalVal)
      return
    }

    // 检测对象
    const predictions = await model.detect(video.value)
    
    ctx.clearRect(0, 0, overlay.value.width, overlay.value.height)

    // 过滤 'person' 类别
    const scoreThreshold = (parseFloat(minScore.value) || 50) / 100
    const persons = predictions.filter(p => p.class === 'person' && p.score >= scoreThreshold)
    
    // 绘制框
    ctx.strokeStyle = '#00b894'
    ctx.lineWidth = 2
    ctx.font = '12px Arial'
    ctx.fillStyle = '#00b894'

    persons.forEach(p => {
      // bbox: [x, y, width, height]
      const [x, y, width, height] = p.bbox
      ctx.strokeRect(x, y, width, height)
      ctx.fillText(`${Math.round(p.score * 100)}%`, x, y > 10 ? y - 5 : 10)
    })

    rawCount.value = predictions.length // 所有检测到的物体
    peopleCount.value = persons.length  // 仅人
    
    // 判定逻辑
    const threshold = parseInt(peopleThreshold.value) || 1
    const danger = persons.length >= threshold

    if (danger) {
      consecutiveCount++
    } else {
      consecutiveCount = 0
    }

    if (!danger) {
      safeCloseCount++
    } else {
      safeCloseCount = 0
    }

    if (consecutiveCount >= consecutiveThreshold && (Date.now() - lastAlertTime) > alertCooldown) {
      lastAlertTime = Date.now()
      consecutiveCount = 0
      safeWindowOpen = true
      log('触发切屏：发送 showSafe IPC')
      try {
        if (window.moyuAPI && typeof window.moyuAPI.showSafe === 'function') {
          window.moyuAPI.showSafe()
          logStatus('检测到他人 -> 已切屏（无声）')
        } else {
          logStatus('检测到他人（本地 API 未暴露）')
        }
      } catch (e) {
        console.error('调用 showSafe 失败', e)
        logStatus('调用 showSafe 失败: ' + e.message)
      }
    } 
    else if (safeCloseCount >= consecutiveThreshold && safeWindowOpen && (Date.now() - lastCloseTime) > closeCooldown) {
      lastCloseTime = Date.now()
      safeCloseCount = 0
      safeWindowOpen = false
      log('触发关闭安全页面：发送 hideSafe IPC')
      try {
        if (window.moyuAPI && typeof window.moyuAPI.hideSafe === 'function') {
          window.moyuAPI.hideSafe()
          logStatus('画面无人 -> 已关闭安全页面')
        } else {
          logStatus('画面无人（本地 API 未暴露）')
        }
      } catch (e) {
        console.error('调用 hideSafe 失败', e)
        logStatus('调用 hideSafe 失败: ' + e.message)
      }
    }
  } catch (e) {
    console.error('detectLoop 错误', e)
    logStatus('检测错误: ' + (e.message || e))
  }

  setTimeout(detectLoop, intervalVal)
}

async function startDetection() {
  if (running) return
  
  log('开始点击：setupCamera -> loadModel -> start loop')
  const ok = await setupCamera()
  if (!ok) {
    logStatus('摄像头初始化失败，无法启动检测')
    return
  }

  if (!modelLoaded) {
    try {
      await loadModel()
    } catch (e) {
      logStatus('模型加载失败，停止启动')
      return
    }
  }

  if (!videoReady || !modelLoaded) {
    logStatus('启动失败：视频或模型未就绪')
    return
  }

  running = true
  logStatus('开始检测...')
  detectLoop()
}

function stopDetection() {
  running = false
  logStatus('已停止检测')
}

onMounted(() => {
  if(overlay.value) {
      ctx = overlay.value.getContext('2d')
  }
  log('等待用户点击开始检测...')
})
</script>

<template>
  <div class="container">
    <header>
      <h2>🐟 摸摸鱼</h2>
      <div class="status-badge" :class="{ active: running }">{{ status }}</div>
    </header>

    <main>
      <div class="video-card">
        <div class="video-wrapper">
          <video ref="video" autoplay muted playsinline></video>
          <canvas ref="overlay"></canvas>
        </div>
        <div class="people-info">
            <div class="stat-item">
                <span class="label">检测人数</span>
                <span class="value" :class="{ danger: peopleCount >= (parseInt(peopleThreshold) || 1) }">{{ peopleCount }}</span>
            </div>
            <div class="stat-item">
                <span class="label">Objects</span>
                <span class="value">{{ rawCount }}</span>
            </div>
        </div>
      </div>

      <div class="controls-card">
        <div class="control-group">
          <label>
            <span>检测间隔 (ms)</span>
            <input v-model="interval" type="number" />
          </label>
          <label>
            <span>人数阈值</span>
            <input v-model="peopleThreshold" type="number" />
          </label>
          <label>
            <span>置信度 (%)</span>
            <input v-model="minScore" type="number" />
          </label>
        </div>
        
        <div class="action-buttons">
          <button class="btn primary" @click="startDetection" :disabled="running">开始检测</button>
          <button class="btn danger" @click="stopDetection" :disabled="!running">停止检测</button>
        </div>
      </div>
    </main>
    
    <div class="debug-panel">
        <h3>调试日志</h3>
        <pre ref="debugLogEl">{{ debugLog }}</pre>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #333;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
}

h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 24px;
}

.status-badge {
  padding: 5px 10px;
  border-radius: 4px;
  background: #eee;
  font-size: 14px;
  font-weight: bold;
}
.status-badge.active {
  background: #e6fffa;
  color: #00b894;
  border: 1px solid #00b894;
}

main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.video-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.video-wrapper {
  position: relative;
  width: 160px;
  height: 120px;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
}

video, canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.people-info {
  display: flex;
  gap: 20px;
  width: 100%;
  justify-content: space-around;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-item .label {
  font-size: 12px;
  color: #666;
}

.stat-item .value {
  font-size: 24px;
  font-weight: bold;
}

.stat-item .value.danger {
  color: #ff4757;
}

.controls-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  padding: 15px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-group label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.control-group input {
  width: 60px;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  flex: 1;
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: opacity 0.2s;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: #3498db;
  color: white;
}
.btn.danger {
  background: #e74c3c;
  color: white;
}

.debug-panel {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  border: 1px solid #eee;
}

.debug-panel h3 {
  margin-top: 0;
  font-size: 16px;
  margin-bottom: 10px;
}

pre {
  background: #fff;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
  max-height: 150px;
  overflow-y: auto;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
