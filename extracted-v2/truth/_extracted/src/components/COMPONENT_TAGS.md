# Component Tags

cleanroom 组件必须在文件顶部保留搜索标签，方便快速定位插槽、依赖和影响范围。

## 标签格式

```ts
// @cleanroom-component: ComponentName
// @domain: teaching-assets | stage-preview | teaching-timeline | inspector | settings | app-shell
// @slot: left-sider | center-stage | center-timeline | right-inspector | topbar-action | modal-layer
// @depends: TeachingProject.assets | TeachingProject.timeline | defaultConfig | local-ui-state
// @route-impact: App shell only | future route: task-review | future route: export-center
```

## 规则

- 每个可插拔组件都必须打标签。
- `@slot` 表示组件插到页面哪里。
- `@depends` 表示它读取哪条唯一真相，不允许写模糊依赖。
- `@route-impact` 表示修改它会影响哪些页面或未来路由。
- 搜索 `@cleanroom-component` 可以列出全部组件。
- 搜索 `@slot: right-inspector` 可以找到右侧属性栏相关组件。
