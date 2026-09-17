// @cleanroom-component: BoardTypographyFields
// @domain: c-canvas-font
// @slot: settings/default-board-font + right-inspector/current-board-font
// @depends: boardFontConfig, antd form/input controls
// @io-input: form name prefix or current BoardTypographyConfig
// @io-output: AppConfig.stageDefaults.canvas fields or TeachingProject.stage.canvas patch
// @boundary: C board typography controls only; never edits UI theme fonts, A audio, or B timing

import { Form, Input, InputNumber, Typography } from 'antd';
import {
  createBoardFontFamily,
  DEFAULT_BOARD_FONT_NAME,
  DEFAULT_BOARD_FONT_SIZE,
  DEFAULT_BOARD_FONT_URL,
  normalizeBoardFontName,
  normalizeBoardFontSize,
  normalizeBoardFontUrl,
  type BoardTypographyConfig,
} from '../modules/boardFont/boardFontConfig';

const { Text } = Typography;
const localFontPlaceholder = '留空使用项目/本机字体；可填 HTTPS 字体 CSS';

type BoardTypographyFormFieldsProps = {
  helpText?: string;
  labelPrefix: string;
  namePrefix: Array<string | number>;
};

type BoardTypographyControlledFieldsProps = {
  labelPrefix: string;
  onChange: (patch: Partial<BoardTypographyConfig>) => void;
  value: BoardTypographyConfig;
};

export function BoardTypographyFormFields({
  helpText,
  labelPrefix,
  namePrefix,
}: BoardTypographyFormFieldsProps) {
  return (
    <>
      <Form.Item label={`${labelPrefix}字体名称`} name={[...namePrefix, 'boardFontName']}>
        <Input placeholder={DEFAULT_BOARD_FONT_NAME} />
      </Form.Item>
      <Form.Item label={`${labelPrefix}字号`} name={[...namePrefix, 'boardFontSize']}>
        <InputNumber min={12} max={96} placeholder={String(DEFAULT_BOARD_FONT_SIZE)} />
      </Form.Item>
      <Form.Item label={`${labelPrefix}字体地址`} name={[...namePrefix, 'boardFontUrl']}>
        <Input placeholder={localFontPlaceholder} />
      </Form.Item>
      {helpText ? <Text type="secondary">{helpText}</Text> : null}
    </>
  );
}

export function BoardTypographyControlledFields({
  labelPrefix,
  onChange,
  value,
}: BoardTypographyControlledFieldsProps) {
  return (
    <>
      <label className="inspector-field">
        <Text strong>{labelPrefix}字体</Text>
        <Input
          onChange={(event) => {
            const boardFontName = normalizeBoardFontName(event.target.value);
            onChange({
              boardFontFamily: createBoardFontFamily(boardFontName),
              boardFontName,
            });
          }}
          placeholder={DEFAULT_BOARD_FONT_NAME}
          value={value.boardFontName || DEFAULT_BOARD_FONT_NAME}
        />
      </label>
      <label className="inspector-field">
        <Text strong>{labelPrefix}字号</Text>
        <InputNumber
          max={96}
          min={12}
          onChange={(nextValue) =>
            onChange({
              boardFontSize: normalizeBoardFontSize(nextValue ?? value.boardFontSize),
            })
          }
          step={1}
          value={value.boardFontSize || DEFAULT_BOARD_FONT_SIZE}
        />
      </label>
      <label className="inspector-field">
        <Text strong>{labelPrefix}字体地址</Text>
        <Input
          onChange={(event) =>
            onChange({
              boardFontUrl: event.target.value,
            })
          }
          onBlur={(event) => {
            const boardFontName = normalizeBoardFontName(value.boardFontName);
            onChange({
              boardFontFamily: createBoardFontFamily(boardFontName),
              boardFontName,
              boardFontUrl: normalizeBoardFontUrl(event.target.value),
            });
          }}
          placeholder={localFontPlaceholder}
          value={value.boardFontUrl || DEFAULT_BOARD_FONT_URL}
        />
      </label>
    </>
  );
}

