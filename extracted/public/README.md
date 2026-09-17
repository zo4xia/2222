# 手写板书 DSL 播放器 · 夏夏版

## 📦 包含文件

| 文件 | 说明 |
|------|------|
| `handdraw-whiteboard.html` | 主程序（单文件，双击即可打开） |
| `fish-tts-proxy.py` | Fish Audio TTS 代理（需要 Python 3.6+） |

## 🚀 快速开始

### 第一步：启动 TTS 代理

```bash
python3 fish-tts-proxy.py
```

看到 `🐟 Fish Audio TTS proxy listening on http://localhost:8787` 就成功了。

### 第二步：打开主程序

双击 `handdraw-whiteboard.html`，用 Chrome 打开。

### 第三步：开始用

1. 点 `🤖 生成` 按钮
2. 粘贴一道小学数学题
3. 点 `▶ 调用 LLM 生成` → 自动生成七列表
4. 点 `▶ 翻译加载` → 画布动画播放
5. 点 `▶ 全文朗读` → TTS 语音播放

## ⌨️ 快捷键

| 键 | 功能 |
|----|------|
| 空格 | 播放/暂停 |
| → | 下一拍 |
| R | 重播 |
| S | 按拍模式开关 |
| C | 配置面板 |
| G | 生成面板 |
| 7 | 七列表面板 |
| D | DSL 编辑器 |
| ESC | 关闭气泡/取消标记 |

## ⚙️ 已预填配置

- **LLM**：Agnes AI（agnes-2.5-flash，免费）
- **TTS**：Fish Audio（s2.1-pro-free + 自定义音色）
- 所有 API Key 已预填，不用手动配置

## 📝 功能清单

- ✅ 手写画布（rough.js 手绘风格）
- ✅ 时间轴（色块 + 拖拽擦洗）
- ✅ 速度/按拍/停顿控制
- ✅ 配置面板（16 类参数可视化调节）
- ✅ 七列表翻译器（actionSpec → DSL）
- ✅ LLM 贴题生成（Agnes AI）
- ✅ TTS 双引擎（Fish Audio + Web Speech）
- ✅ 气泡编辑器（双击块编辑口播+板书+标记）
- ✅ 数学公式渲染（分数/根号/上下标/希腊字母）
- ✅ 8 种标记符号 + 素材工具栏（拖拽/缩放/插入）
- ✅ 口播规范校验
- ✅ 板书规范自动修复（× → x，7/15 → 分数）
