# 0019：受限 BPMN 可视化设计器

状态：已采用，2026-10-10。用户要求在既有 Flowable 集成上完成可视化设计器。

使用固定版本 bpmn-js 18.31.0 官方 Modeler、moddle 扩展和命令栈；保留 bpmn.io 可见署名和许可。编辑器按需加载，复用框架按钮、输入、对话框与草稿保护。该依赖不改变 EForge 与 RuoYi 基线，也不引入 Camunda 服务端。

画布只提供已受后端支持的开始、人工审批、排他分支、结束和顺序流。审批绑定及条件沿用 Flowable 白名单，布局元数据不获得执行权限。后端仍验证全部 BPMN；仅新增严格检查的 DI、incoming/outgoing。客户端校验只用于即时反馈。

画布编辑保存完整 XML，沿用版本化流程包 API、场景校验、不可变发布和独立激活。现有 DI 原样导入；无 DI 的旧流程补充初始布局。未应用属性阻止保存/切换，失败不替换源码，冲突不覆盖草稿。

不引入通用表单构建、复杂会签、脚本节点或实例迁移。源码入口继续保留；不为画布新增重复的流程执行 API。编辑器独立压缩包约 174 KB gzip，仅进入设计器时加载。

许可原文见 [bpmn-js-LICENSE.txt](../bpmn-js-LICENSE.txt)。来源：[官方集成说明](https://bpmn.io/toolkit/bpmn-js/walkthrough/)、[官方模型扩展](https://github.com/bpmn-io/bpmn-js-example-model-extension)。
