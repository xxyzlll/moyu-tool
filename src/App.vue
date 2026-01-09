<script setup>
import { ref } from 'vue'
import Detector from './components/Detector.vue'

// 浏览器相关状态
const urlInput = ref('https://www.baidu.com')
const webviewSrc = ref(null)
const webviewRef = ref(null)
const isLoading = ref(false)

// 弹窗状态
const showDetector = ref(false)

// 导航方法
function navigate() {
  let url = urlInput.value
  if (!url.startsWith('http')) {
    url = 'https://' + url
  }
  webviewSrc.value = url
}

function goBack() {
  if (webviewRef.value && webviewRef.value.canGoBack()) {
    webviewRef.value.goBack()
  }
}

function goForward() {
  if (webviewRef.value && webviewRef.value.canGoForward()) {
    webviewRef.value.goForward()
  }
}

function reload() {
  if (webviewRef.value) {
    webviewRef.value.reload()
  }
}

// 监听 webview 事件
function onDomReady() {
  // Webview DOM ready
}

function onDidStartLoading() {
  isLoading.value = true
}

function onDidStopLoading() {
  isLoading.value = false
  // 更新地址栏
  if (webviewRef.value) {
    urlInput.value = webviewRef.value.getURL()
  }
}

// 切换检测器弹窗
function toggleDetector() {
  showDetector.value = !showDetector.value
}
</script>

<template>
  <div class="app-container">
    <!-- 浏览器顶部导航栏 -->
    <div class="browser-bar">
      <div class="nav-buttons">
        <button @click="goBack" title="后退">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <button @click="goForward" title="前进">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
        <button @click="reload" title="刷新">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>
      
      <form @submit.prevent="navigate" class="url-form">
        <input 
          v-model="urlInput" 
          type="text" 
          placeholder="输入网址..."
          class="url-input"
        />
        <button type="submit" class="go-btn">进入</button>
      </form>
    </div>

    <!-- Webview 区域 -->
    <div class="webview-container">
      <webview 
       v-if="webviewSrc"
        ref="webviewRef"
        :src="webviewSrc" 
        class="webview"
        allowpopups
        @dom-ready="onDomReady"
        @did-start-loading="onDidStartLoading"
        @did-stop-loading="onDidStopLoading"
      ></webview>
      <div v-else class="empty-state">
        <div class="empty-content">
          <div class="icon-wrapper">
            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </div>
          <h2>欢迎使用MOYU浏览器</h2>
          <p>在上方地址栏输入网址开始摸鱼，或者试试以下热门网站</p>
          <div class="quick-links">
            <button @click="urlInput = 'https://www.baidu.com'; navigate()" class="link-card">
              <span>百度一下</span>
            </button>
            <button @click="urlInput = 'https://www.bilibili.com'; navigate()" class="link-card">
              <span>Bilibili</span>
            </button>
            <button @click="urlInput = 'https://github.com'; navigate()" class="link-card">
              <span>GitHub</span>
            </button>
            <button @click="urlInput = 'https://v3.cn.vuejs.org'; navigate()" class="link-card">
              <span>Vue.js</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 悬浮球 -->
    <button class="fab" @click="toggleDetector" title="打开摸鱼助手">
      🐟
    </button>

    <!-- 弹窗遮罩层 -->
    <div v-show="showDetector" class="modal-overlay" @click.self="showDetector = false">
      <div class="modal-content">
        <button class="close-btn" @click="showDetector = false">×</button>
        <!-- 即使隐藏，Detector 组件依然保持挂载和运行 -->
        <Detector />
      </div>
    </div>
    
    <!-- 即使不显示弹窗，Detector 组件也必须在 DOM 中运行检测逻辑 -->
    <!-- 我们使用 v-show="false" 的方式将其隐藏在背景中，或者将其渲染在一个不可见的容器里 -->
    <!-- 上面的 modal-content 是弹窗显示的位置。为了保证 Detector 一直运行，我们不能用 v-if -->
    <!-- 这里的逻辑是：Detector 始终渲染在 Modal Content 里，Modal 本身通过 v-show 控制显隐 -->
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #fff;
}

.browser-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  gap: 12px;
  height: 50px;
}

.nav-buttons {
  display: flex;
  gap: 4px;
}

.nav-buttons button {
  background: transparent;
  border: none;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
  color: #555;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-buttons button:hover {
  background: #e0e0e0;
}

.url-form {
  flex: 1;
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.url-input:focus {
  border-color: #3498db;
}

.go-btn {
  padding: 0 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
}

.go-btn:hover {
  background: #2980b9;
}

.webview-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.webview {
  width: 100%;
  height: 100%;
  border: none;
}

/* 悬浮球 */
.fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #3498db;
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  font-size: 24px;
  cursor: pointer;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, background 0.2s;
}

.fab:hover {
  transform: scale(1.1);
  background: #2980b9;
}

.fab:active {
  transform: scale(0.95);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(2px);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 800px;
  height: 80%;
  max-height: 700px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  overflow: hidden;
  animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 15px;
  background: transparent;
  border: none;
  font-size: 28px;
  color: #888;
  cursor: pointer;
  z-index: 10;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

@keyframes modalPop {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
