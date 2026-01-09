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

// 快速链接数组
const quickLinks = ref([
  { name: '百度一下', url: 'https://www.baidu.com' },
  { name: 'Bilibili', url: 'https://www.bilibili.com' },
  { name: '抖音', url: 'https://www.douyin.com' },
  { name: '谷歌', url: 'https://www.google.com' },
  { name: '淘宝', url: 'https://www.taobao.com' },
  { name: '腾讯视频', url: 'https://v.qq.com' },
  { name: '爱奇艺', url: 'https://www.iqiyi.com' },
  { name: '优酷', url: 'https://www.youku.com' },
  { name: '芒果TV', url: 'https://www.mgtv.com' },
  { name: '腾讯新闻', url: 'https://news.qq.com' },
  { name: '今日头条', url: 'https://www.toutiao.com' },
])

// 导航方法
function navigate() {
  let url = urlInput.value
  if (!url.startsWith('http')) {
    url = 'https://' + url
  }
  webviewSrc.value = url
}

function goHome() {
  urlInput.value = null
  webviewSrc.value = null
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
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button @click="goForward" title="前进">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <button @click="reload" title="刷新">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      <form @submit.prevent="navigate" class="url-form">
        <input v-model="urlInput" type="text" placeholder="输入网址..." class="url-input" />
        <button type="submit" class="go-btn">进入</button>
        <button type="button" class="go-btn" @click="goHome">回到首页</button>
      </form>
    </div>

    <!-- Webview 区域 -->
    <div class="webview-container">
      <webview v-if="webviewSrc" ref="webviewRef" :src="webviewSrc" class="webview" allowpopups @dom-ready="onDomReady"
        @did-start-loading="onDidStartLoading" @did-stop-loading="onDidStopLoading"></webview>
      <template v-else>
        <div class="empty-state">
          <div class="empty-content">
            <div class="icon-wrapper">
              <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z">
                </path>
              </svg>
            </div>
            <h2>欢迎使用MOYU浏览器</h2>
            <p>在上方地址栏输入网址开始摸鱼，点击悬浮球打开摸鱼助手开始检测!</p>
            <div class="quick-links">
              <button v-for="link in quickLinks" :key="link.url" @click="urlInput = link.url; navigate()" class="link-card">
                <span>{{ link.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>
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
  margin-left: 8px;
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

.empty-state {
  width: 100%;
  height: 100%;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4eaf5 100%);
  padding: 20px;
  box-sizing: border-box;
}

/* 内容容器 */
.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  padding: 48px 32px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  max-width: 500px;
  width: 100%;
}

/* 图标容器 */
.icon-wrapper {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.icon-wrapper:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 28px rgba(102, 126, 234, 0.4);
}

.icon-wrapper svg {
  stroke: #ffffff;
  width: 72px;
  height: 72px;
}

/* 标题样式 */
.empty-content h2 {
  font-size: 28px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 16px;
  letter-spacing: 0.5px;
}

/* 描述文本样式 */
.empty-content p {
  font-size: 16px;
  color: #718096;
  line-height: 1.6;
  margin-bottom: 40px;
  padding: 0 20px;
}

/* 快捷链接容器 */
.quick-links {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  width: 100%;
}

/* 链接卡片样式 */
.link-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: none;
  border-radius: 12px;
  padding: 20px 16px;
  font-size: 16px;
  font-weight: 500;
  color: #2d3748;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.link-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(102, 126, 234, 0.1), transparent);
  transition: all 0.5s ease;
}

.link-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #f0f4ff 0%, #e4eaf5 100%);
  color: #667eea;
}

.link-card:hover::before {
  left: 100%;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .empty-content {
    padding: 36px 24px;
  }

  .icon-wrapper {
    width: 100px;
    height: 100px;
    margin-bottom: 24px;
  }

  .icon-wrapper svg {
    width: 60px;
    height: 60px;
  }

  .empty-content h2 {
    font-size: 24px;
  }

  .empty-content p {
    font-size: 15px;
    margin-bottom: 32px;
  }

  .quick-links {
    gap: 12px;
  }

  .link-card {
    padding: 16px 12px;
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .quick-links {
    grid-template-columns: 1fr;
  }

  .empty-content {
    padding: 28px 16px;
  }

  .empty-content h2 {
    font-size: 22px;
  }
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
  background: rgba(0, 0, 0, 0.5);
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
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
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
