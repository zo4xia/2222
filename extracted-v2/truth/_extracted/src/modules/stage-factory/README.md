# stage-factory

@cleanroom-module
@domain stage
@depends none
@route-impact low

## 模块定位
舞台工厂占位模块，预留舞台渲染、编排与展示元件的接入位。

## 入线口
- `src/modules/stage-factory/index.ts`
- `src/modules/stage-factory/types.ts`

## 接线口
- 未来的舞台预览层、场景配置层、联动入口。

## 禁止事项
- 不要直接引入 `src/components` 的现有实现。
- 不要把路由、状态或样式逻辑写进这里。
- 不要引用外部项目代码或临时搬运文件。
