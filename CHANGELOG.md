# [2.2.0](https://github.com/chiimagnus/logseq-AIsearch/compare/v2.1.0...v2.2.0) (2025-07-07)


### Bug Fixes

* **storage:** 修复分片数据加载和保存的逻辑 ([b5f4e19](https://github.com/chiimagnus/logseq-AIsearch/commit/b5f4e19b4367384fee16fc3ffed7b137519c5d0e))


### Features

* **core:** 实现分片索引优化 ([a349324](https://github.com/chiimagnus/logseq-AIsearch/commit/a3493248b476ae4d5e446033fcc749261f93f596))
* **vector:** 优化向量索引重建逻辑 ([90e0e74](https://github.com/chiimagnus/logseq-AIsearch/commit/90e0e749657fe6194b2f9e7e6be26c2c3d7b1e93))
* **vector:** 实现向量数据的精确删除和更新 ([67f0101](https://github.com/chiimagnus/logseq-AIsearch/commit/67f0101c426dff371fcffbe21251f1405d7577a1))
* **vector:** 实现增量索引和智能保存策略 ([6764372](https://github.com/chiimagnus/logseq-AIsearch/commit/67643728a90f35a27ed3e32453d40467b911e98a))
* **vector:** 实现智能增量索引，优化索引效率 ([dd18163](https://github.com/chiimagnus/logseq-AIsearch/commit/dd18163ae69e9cea3f9d2027d28d8a7fbf378ec3))
* **vector:** 实现真正的增量索引功能 ([3d7e652](https://github.com/chiimagnus/logseq-AIsearch/commit/3d7e65286ccfff39f5764dfac152601f1fb48186))
* **vector:** 实现静默增量索引并优化搜索功能 ([ec85619](https://github.com/chiimagnus/logseq-AIsearch/commit/ec856193bb1dffaa8d2c0b3f48aa2af24fd78b9d))


### Performance Improvements

* **代码分割:** 实现代码按需加载以优化性能 ([f5dc900](https://github.com/chiimagnus/logseq-AIsearch/commit/f5dc900afdbaba7f848ead33f11ed33873970e52))

# [2.1.0](https://github.com/chiimagnus/logseq-AIsearch/compare/v2.0.0...v2.1.0) (2025-07-07)


### Features

* **core:** 优化向量数据处理和索引建立流程 ([0fbf646](https://github.com/chiimagnus/logseq-AIsearch/commit/0fbf646218c3176ce75bb563b0545f3bf97614c1))
* **core:** 优化数据保存和索引性能 ([f5de270](https://github.com/chiimagnus/logseq-AIsearch/commit/f5de270a234dc503c359d2561c1b6221c5446d28))
* **storage:** 优化向量数据存储和缓存机制 ([d3466cc](https://github.com/chiimagnus/logseq-AIsearch/commit/d3466ccabe54b199569911f1546cfc52bcbc30c3))
* **storage:** 增加 JSON 文件支持并优化向量数据存储 ([26162d0](https://github.com/chiimagnus/logseq-AIsearch/commit/26162d0d25b1a95453bbf1343b066f25f7fb1000))
* **storage:** 重构向量数据存储方案 ([dc1e7ca](https://github.com/chiimagnus/logseq-AIsearch/commit/dc1e7caa6b7840a15bbd5a056cbed277fb25d2eb))
* **vector:** 实现内存缓存机制并优化向量搜索功能 ([8bbe6f2](https://github.com/chiimagnus/logseq-AIsearch/commit/8bbe6f209bfbd4db9738253485b575784d0d0acf))
* **vector:** 重构向量数据存储为分片式架构 ([52474a9](https://github.com/chiimagnus/logseq-AIsearch/commit/52474a95d2606bb162a93d7f24934a2d65d060c1))

# [2.0.0](https://github.com/chiimagnus/logseq-AIsearch/compare/v1.9.3...v2.0.0) (2025-07-06)


### Features

* **debug:** 添加向量数据详情的调试命令 ([6159822](https://github.com/chiimagnus/logseq-AIsearch/commit/6159822b9fe5c4846d47c98fb4e8221f8752b07c))
* **debug:** 添加清除向量数据的调试命令 ([53340d3](https://github.com/chiimagnus/logseq-AIsearch/commit/53340d314ff84dd18a5d278da436b61fb8482311))
* **index:** 优化向量索引功能 ([3d2080a](https://github.com/chiimagnus/logseq-AIsearch/commit/3d2080a667ba816aa002ab1c90bc4272098fe4bc))
* **main:** 更新向量搜索功能和用户指南 ([dacddb1](https://github.com/chiimagnus/logseq-AIsearch/commit/dacddb1a6a8c6e04541a17540b08cd929c5b2707))
* **search:** 优化向量搜索和结果过滤 ([dafe36c](https://github.com/chiimagnus/logseq-AIsearch/commit/dafe36c25b91a17fe5971373d6291ffd050df86e))
* **search:** 添加向量搜索功能 ([ed06e11](https://github.com/chiimagnus/logseq-AIsearch/commit/ed06e117259b67b21a3708874afbd6faf5b52bea))
* **search:** 添加重建 AI 索引功能 ([fdba2f9](https://github.com/chiimagnus/logseq-AIsearch/commit/fdba2f9f5276e002c3028f9cecbb772d946ba1bf))
* **services:** 添加向量索引服务 ([0ce4e28](https://github.com/chiimagnus/logseq-AIsearch/commit/0ce4e28e292bfae7776c66517b1c608a34aadbba))
* **service:** 优化向量数据存储和处理 ([f977d7c](https://github.com/chiimagnus/logseq-AIsearch/commit/f977d7c103fbd2feb0d407b9b28830fdfbc2213b))
* **settings, services:** 添加向量化设置和调试功能 ([0253b00](https://github.com/chiimagnus/logseq-AIsearch/commit/0253b00987c9f5c95b7d5029d626bdbfcfb4a9ce))
* **settings:** 增加 embedding 模型选择和相关配置 ([f99a419](https://github.com/chiimagnus/logseq-AIsearch/commit/f99a419739d59cc9e3faccc3ded1330522ef0040))
* **setting:** 增加向量搜索设置 ([dcabcbe](https://github.com/chiimagnus/logseq-AIsearch/commit/dcabcbed7bfb8ed0e31d3849f36e31c1d76e595f))
* **storage:** 优化 Assets API 存储实现并添加数据压缩功能 ([a355f80](https://github.com/chiimagnus/logseq-AIsearch/commit/a355f8069139209d405b5deefde7561a5abcf657))
* **storage:** 实现分块压缩存储和存储后端切换功能 ([9fa8ba7](https://github.com/chiimagnus/logseq-AIsearch/commit/9fa8ba723aac0fd39c239032f3d25319fb763d60))
* **vectorService:** 优化索引建立过程 ([071161b](https://github.com/chiimagnus/logseq-AIsearch/commit/071161b6ee58db75f48b02a130fa1ea72cd952d6))
* **vectorService:** 允许用户自定义向量存储后端 ([795aded](https://github.com/chiimagnus/logseq-AIsearch/commit/795adedbf195629d7d3429fc9482f8be392ba597))
* **vectorService:** 用 DuckDB-WASM 替代 LanceDB ([043f9fb](https://github.com/chiimagnus/logseq-AIsearch/commit/043f9fbea4341ca4a53656d28c98796dd99be2ac))
* **vectorService:** 重构向量存储并优化搜索功能 ([50fb106](https://github.com/chiimagnus/logseq-AIsearch/commit/50fb10655ec8f0469a814a24657d2a2739dc7be7))
* **vectorService:** 重构向量服务并添加新功能 ([ddd1416](https://github.com/chiimagnus/logseq-AIsearch/commit/ddd141618500a689d780044e4eba5836cca0547a))
* **vector:** 添加向量数据完整性检查和修复功能 ([ed8cb54](https://github.com/chiimagnus/logseq-AIsearch/commit/ed8cb541d673a4b3060dfba5a301d05ee32507f2))


### Performance Improvements

* **index:** 优化索引建立过程 ([ee8e3b5](https://github.com/chiimagnus/logseq-AIsearch/commit/ee8e3b57332e69029fb71e244f50c9c70d519b47))
