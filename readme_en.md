<h1 align="center">
    🎉 AI Search
</h1>

<div align="center">
    <a href="readme.md">中文</a> | <a href="readme_en.md">English</a>
</div>

An AI-based intelligent search plugin for Logseq that can perform global document searches based on the current block content and provide AI-powered summary features.

## ✨ Main Features

### 🔍 AI Intelligent Search
- Intelligent search based on the current block content
- AI-powered summary of search results
- Link to original notes
- Support for custom LLM API

### 🤖 AI Multi-Style Response
- Warm Response: Provides understanding, support, and encouragement
- Straight to the Point: Directly identifies core issues or insights
- Thought-Provoking: Poses deep questions to guide further thinking
- Inspiration Spark: Re-examines problems from different perspectives to inspire creativity and new possibilities
- Cosmic Perspective: Thinks from a grander temporal and spatial dimension

## 🚀 Quick Start

### AI Search Usage
- Command: Enter `/AI-Search`
- Shortcut: `alt+mod+a`
  - Mac: `⌥ + ⌘ + A` (Alt + Command + A)
  - Windows: `Alt + Ctrl + A`

### AI Response Usage
1. **Configure Response Style**: Select your preferred AI response style in the plugin settings.

2. **Use AI Response**:
   - Select one or more blocks
   - Trigger AI response using one of the following methods:
     - Command: Enter `/AI-Response`
     - Shortcut: `alt+mod+r`
       - Mac: `⌥ + ⌘ + R` (Alt + Command + R)
       - Windows: `Alt + Ctrl + R`

3. **View Results**:
   - AI will generate responses based on your configured style, saved to the "AIResponse" page
   - Reference links to AI responses will be automatically inserted next to the original blocks

## 📸 Feature Showcase
- [demo.mp4](https://github.com/chiimagnus/logseq-AIsearch/blob/master/public/demo.mp4)
or
[demo_bilibili](https://www.bilibili.com/video/BV1pC6wYXE93)

- Prompts are located in [`src/prompts`](https://github.com/chiimagnus/logseq-AIsearch/tree/master/src/prompts). As my prompt engineering skills are limited, I sincerely welcome everyone to submit issues with suggestions.

## Development Plan
- [ ] Implement AI intent recognition and tool invocation.

## 🙏 Acknowledgments
- [Logseq Plugin API Documentation](https://plugins-doc.logseq.com/)
- [Logseq Plugin Development in Action](https://correctroad.gitbook.io/logseq-plugins-in-action/chapter-1/make-logseq-plugins-support-settings)
- [logseq-plugins-smartsearch](https://github.com/sethyuan/logseq-plugin-smartsearch)
- [ollama-logseq](https://github.com/omagdy7/ollama-logseq)
- [logseq-plugin-link-preview](https://github.com/pengx17/logseq-plugin-link-preview)

Special thanks to the ollama-logseq developer [@omagdy7](https://github.com/omagdy7) for helping me solve the CORS issue: [Reference Link](https://github.com/omagdy7/ollama-logseq/issues/32)

## ☕️ Support the Author
[buymeacoffee](https://github.com/chiimagnus/logseq-AIsearch/blob/master/public/buymeacoffee.jpg)
<div align="center">
  <img src="https://github.com/chiimagnus/logseq-AIsearch/blob/master/public/buymeacoffee.jpg" width="400">
</div> 