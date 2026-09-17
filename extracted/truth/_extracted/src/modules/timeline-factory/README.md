# timeline-factory

@cleanroom-module
@domain timeline
@depends none
@route-impact low

## 模块定位
时间线工厂占位模块，预留课件节奏、时间轴与步骤编排元件的目录。

## 入线口
- `src/modules/timeline-factory/index.ts`
- `src/modules/timeline-factory/types.ts`

## 接线口
- 未来的时间线数据、步骤控制、进度联动。

## 禁止事项
- 不要直接引入 `src/components` 的现有实现。
- 不要把路由、状态或样式逻辑写进这里。
- 不要引用外部项目代码或临时搬运文件。
