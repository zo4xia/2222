// @cleanroom-component: FloatingToolDock
// @domain: inspector
// @slot: right-floating-dock
// @depends: local-ui-state, future TeachingProject.stage
// @io-input: none
// @io-output: future tool action events
// @route: App shell / stage floating tools
// @fields: future TeachingProject.stage tools/effects/background/fonts
// @boundary: visual shortcut dock only; current buttons do not mutate stage, do not open settings, do not call API
// @route-impact: App shell only

import {
  AppstoreOutlined,
  BgColorsOutlined,
  PictureOutlined,
  RadiusSettingOutlined,
} from '@ant-design/icons';

const dockItems = [
  { key: 'effects', label: '动效', description: '描写、淡入、轻弹出', icon: <RadiusSettingOutlined /> },
  { key: 'stickers', label: '贴图素材', description: 'C 素材、图章、标记', icon: <PictureOutlined /> },
  { key: 'geometry', label: '几何图形', description: '线段、圆、角、坐标', icon: <AppstoreOutlined /> },
  { key: 'background', label: '画布背景', description: '课件边框、纸张、网格', icon: <BgColorsOutlined /> },
];

export function FloatingToolDock() {
  return (
    <aside aria-label="舞台快捷工具" className="side-tool-dock">
      {dockItems.map((item) => (
        <button className="side-tool-card" key={item.key} type="button">
          <span className="side-tool-icon">{item.icon}</span>
          <span className="side-tool-copy">
            <strong>{item.label}</strong>
            <small>{item.description}</small>
          </span>
        </button>
      ))}
    </aside>
  );
}
