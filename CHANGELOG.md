# Changelog

## [v0.10.1]
### Added
- 新增快捷键功能，用户可自定义，默认为alt+mod+a

## [v0.9.11]
### Changed
- AI总结成为可选项，默认关闭

## [v0.9.10]
### Changed
- 优化关键词提取prompt
- 优化AI筛选prompt
- 优化AI总结prompt
### Added
- 增加时间维度（alpha）

## [v0.9.6]
### Note
- 可能会调用较多的ollama模型资源，因此会占用较大的Mac内存
- 目前还在探索如何在保持搜索准确性的同时降低性能消耗

## [v0.8.1]
### Changed
- 修改关键词提取的prompt
- 修改AI总结的prompt
### Removed
- 删除用户自定义prompt功能
### Changed
- 不限制原始笔记的展示数量

## [v0.7.2]
### Added
- 新增查询过程消息弹窗，会自动关闭
### Changed
- 重做结果呈现的笔记结构
  - 父块（问题）
  - 子块（AI总结）
  - 子块（笔记来源）

## [v0.5.1]
### Added
- 新增查询过程的等待消息
  - 正在搜索：关键词1,2,3......
  - 正在总结

## [v0.4.9]
### Added
- 新增功能：用户自定义prompt

## [v0.4.7]
### Added
- 允许用户自定义 Ollama 主机地址和模型

## [v0.4.0]
### Added
- 首次发布版本