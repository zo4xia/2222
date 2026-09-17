// @cleanroom-component: AppSettingsDrawer
// @domain: settings
// @slot: modal-layer
// @depends: defaultConfig, future persisted config, future recognition-ai-config
// @feature-branch: recognition-ai-config
// @feature-branch: automation-unattended-mode
// @io-input: open, config, onClose, onSaveConfig
// @io-output: onSaveConfig(config), onClose()
// @route: App shell / settings drawer
// @fields: defaultConfig.service, defaultConfig.recognition, defaultConfig.scriptAgent, defaultConfig.tts, defaultConfig.vectorKb, defaultConfig.automation, defaultConfig.stageDefaults, defaultConfig.typography, defaultConfig.effects, defaultConfig.output
// @boundary: AppConfig settings UI only; persists config reference values, does not store raw API keys, does not call external APIs
// @route-impact: App shell only, future route: settings
// @api-needed: settings-persistence-api | trigger: user saves config | output: persisted AppConfig without raw secrets
// @api-needed: recognition-ai-api config | trigger: problem import | output: OCR/problemText provider config
// @api-needed: script-agent-api config | trigger: script-board Agent | output: endpoint/model/apiKeyRef config
// @api-needed: vector-kb-api config | trigger: script Agent retrieval | output: provider/collection/topK config

import { Alert, Button, Descriptions, Drawer, Form, Input, InputNumber, Select, Space, Switch, Tabs, Tag, Typography } from 'antd';
import type { FormInstance } from 'antd';
import { useEffect, useState } from 'react';
import { defaultConfig, type AppConfig } from '../config/defaultConfig';
import { BoardTypographyFormFields } from './BoardTypographyFields';
const { Text } = Typography;
const { TextArea } = Input;

export function AppSettingsDrawer({
  config,
  open,
  onClose,
  onSaveConfig,
}: {
  config: AppConfig;
  open: boolean;
  onClose: () => void;
  onSaveConfig: (config: AppConfig) => void;
}) {
  const [form] = Form.useForm<AppConfig>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue(config);
      setHasUnsavedChanges(false);
    }
  }, [config, form, open]);

  const handleFinish = (values: AppConfig) => {
    onSaveConfig(values);
    setHasUnsavedChanges(false);
    onClose();
  };

  return (
    <Drawer
      destroyOnHidden
      extra={<Tag color={hasUnsavedChanges ? 'orange' : 'green'}>{hasUnsavedChanges ? '有未保存修改' : '配置已同步'}</Tag>}
      footer={
        <div className="settings-drawer-footer">
          <Text type="secondary">修改配置后，需要点击确认保存才会生效。</Text>
          <Space>
            <Button
              onClick={() => {
                form.setFieldsValue(config);
                setHasUnsavedChanges(false);
              }}
            >
              取消修改
            </Button>
            <Button
              onClick={() => {
                form.setFieldsValue(defaultConfig);
                setHasUnsavedChanges(true);
              }}
            >
              恢复默认
            </Button>
            <Button disabled={!hasUnsavedChanges} onClick={() => form.submit()} type="primary">
              确认保存配置
            </Button>
          </Space>
        </div>
      }
      onClose={onClose}
      open={open}
      placement="right"
      size={560}
      title="全局配置"
    >
      <Form
        form={form}
        initialValues={config}
        layout="vertical"
        onFinish={handleFinish}
        onValuesChange={() => setHasUnsavedChanges(true)}
      >
        <Tabs
          items={[
            {
              key: 'modelSwitchboard',
              label: '模型总闸',
              children: <ModelSwitchboardSettings form={form} />,
            },
            {
              key: 'api',
              label: 'API',
              children: <ApiSettings />,
            },
            {
              key: 'recognition',
              label: '识别模型',
              children: <RecognitionSettings />,
            },
            {
              key: 'agent',
              label: '文稿模型',
              children: <ScriptAgentSettings />,
            },
            {
              key: 'knowledge',
              label: '知识库',
              children: <VectorKbSettings />,
            },
            {
              key: 'tts',
              label: '语音模型',
              children: <TtsSettings />,
            },
            {
              key: 'automation',
              label: '审核闸门',
              children: <AutomationSettings />,
            },
            {
              key: 'canvas',
              label: '画布',
              children: <CanvasSettings form={form} />,
            },
            {
              key: 'typography',
              label: 'C 素材默认',
              children: <TypographySettings />,
            },
            {
              key: 'effects',
              label: 'C 素材动效',
              children: <EffectSettings />,
            },
            {
              key: 'files',
              label: '保存',
              children: <FileSettings />,
            },
          ]}
        />
      </Form>
    </Drawer>
  );
}

function ModelSwitchboardSettings({ form }: { form: FormInstance<AppConfig> }) {
  return (
    <Form.Item noStyle shouldUpdate>
      {() => {
        const values = form.getFieldsValue(true) as AppConfig;
        const recognition = values.recognition ?? defaultConfig.recognition;
        const scriptAgent = values.scriptAgent ?? defaultConfig.scriptAgent;
        const tts = values.tts ?? defaultConfig.tts;

        return (
          <div>
            <Alert
              showIcon
              type="info"
              title="先选模型总闸，再调提示词"
              description="真实业务当前分三路：识别题图/题文的视觉模型，生成 rows 候选的文稿模型（voiceText + boardSlice + A-template / A1/B1/C1 命名合同），生成 A 轨音频的语音模型。客户定制可以使用客户自己的 key，但明文 key 应由管理员配置到后端密钥管理或本地网关环境变量里，业务前端只保存引用名。"
            />
            <Descriptions bordered column={1} size="small" className="settings-switchboard">
              <Descriptions.Item label="题图/题文识别">
                <Space wrap>
                  <Tag color="blue">{recognition.provider}</Tag>
                  <Tag>{recognition.modelName || '未填写模型'}</Tag>
                  <Tag>{recognition.apiKeyRef}</Tag>
                  <Text type="secondary">{recognition.endpoint || '未填写 Endpoint'}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="rows 文稿 + C素材候选">
                <Space wrap>
                  <Tag color="geekblue">{scriptAgent.mode}</Tag>
                  <Tag>{scriptAgent.modelName || '未填写模型'}</Tag>
                  <Tag>{scriptAgent.apiKeyRef}</Tag>
                  <Text type="secondary">{scriptAgent.endpoint || '未接外部 Agent Endpoint'}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="A 轨语音">
                <Space wrap>
                  <Tag color="green">{tts.provider}</Tag>
                  <Tag>{tts.modelName}</Tag>
                  <Tag>{tts.voiceName}</Tag>
                  <Tag>{tts.apiKeyRef}</Tag>
                  <Text type="secondary">{tts.endpoint}</Text>
                </Space>
              </Descriptions.Item>
            </Descriptions>
            <Text type="secondary">
              这里不保存明文 Key，也不把配置显示成调用成功；真正的识别、Agent、TTS 调用必须由各自步骤按这份配置走网关。
            </Text>
          </div>
        );
      }}
    </Form.Item>
  );
}

// @xiaxia-settings-hint: Aliyun A-track fields here must stay paired with cosyvoiceGatewayClient and both CosyVoice gateways.
function TtsSettings() {
  return (
    <div>
      <Form.Item label="A 轨语音 Provider" name={['tts', 'provider']}>
        <Select options={[{ value: 'aliyun-cosyvoice', label: '阿里云 CosyVoice' }]} />
      </Form.Item>
      <Form.Item label="A 轨语音网关" name={['tts', 'endpoint']}>
        <Input placeholder="/api/tts/cosyvoice/sentences" />
      </Form.Item>
      <Form.Item label="密钥引用/环境变量名" name={['tts', 'apiKeyRef']} extra="客户定制时可换成客户的密钥引用名；明文 key 由管理员配置在后端或本地网关环境中。">
        <Input placeholder="DASHSCOPE_API_KEY" />
      </Form.Item>
      <Form.Item label="语音模型" name={['tts', 'modelName']}>
        <Input placeholder="cosyvoice-v3-flash" />
      </Form.Item>
      <Form.Item label="A 轨音色" name={['tts', 'voiceName']}>
        <Input placeholder="longanyang" />
      </Form.Item>
      <Form.Item label="A 轨音频格式" name={['tts', 'format']}>
        <Select
          options={[
            { value: 'mp3', label: 'mp3' },
            { value: 'wav', label: 'wav' },
          ]}
        />
      </Form.Item>
      <Form.Item label="A 轨采样率" name={['tts', 'sampleRate']}>
        <InputNumber min={8000} max={48000} step={50} />
      </Form.Item>
      <Form.Item label="A 轨字级时间戳" name={['tts', 'wordTimestampEnabled']} valuePropName="checked">
        <Switch checkedChildren="开启" unCheckedChildren="关闭" />
      </Form.Item>
      <Tag color="green">real-tts-gateway</Tag>
      <Text type="secondary">
        当前语音步骤读取这份配置，请求同源本地网关；真实密钥只由 Node/Vite 服务从本地环境读取。
      </Text>
    </div>
  );
}

function AutomationSettings() {
  return (
    <div>
      <Form.Item label="运行模式" name={['automation', 'mode']}>
        <Select
          options={[
            { value: 'manual-review', label: '人工审核模式（推荐）' },
            { value: 'unattended', label: '自动化无人值守模式' },
          ]}
        />
      </Form.Item>
      <Form.Item label="A 轨语音前需要人工确认" name={['automation', 'requireReviewBeforeTts']} valuePropName="checked">
        <Switch checkedChildren="需要" unCheckedChildren="跳过" />
      </Form.Item>
      <Form.Item label="上时间轴前需要人工确认" name={['automation', 'requireReviewBeforeTimeline']} valuePropName="checked">
        <Switch checkedChildren="需要" unCheckedChildren="跳过" />
      </Form.Item>
      <Form.Item label="录屏交付前需要人工确认" name={['automation', 'requireReviewBeforeRecording']} valuePropName="checked">
        <Switch checkedChildren="需要" unCheckedChildren="跳过" />
      </Form.Item>
      <Tag color="purple">automation-unattended-mode</Tag>
      <Text type="secondary">
        当前只预留模式开关和审核闸门；真实无人值守执行必须后续接任务队列、错误中断和结果回填。
      </Text>
    </div>
  );
}

function ApiSettings() {
  return (
    <div>
      <Form.Item label="服务地址" name={['service', 'baseUrl']}>
        <Input placeholder="后续接入本地服务或网关" />
      </Form.Item>
      <Form.Item label="Socket Path" name={['service', 'socketPath']}>
        <Input placeholder="/socket.io" />
      </Form.Item>
      <Form.Item label="飞书回填" name={['feishu', 'enabled']} valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="关闭" />
      </Form.Item>
      <Form.Item label="飞书密钥 Header" name={['feishu', 'webhookSecretHeader']}>
        <Input placeholder="X-Feishu-Webhook-Secret" />
      </Form.Item>
      <Text type="secondary">这里后续只读写唯一配置真相，不在组件里私藏 API Key。客户自有 key 通过后端密钥管理或本地网关接入。</Text>
    </div>
  );
}

function RecognitionSettings() {
  return (
    <div>
      <Form.Item label="视觉模型 Provider" name={['recognition', 'provider']}>
        <Select
          options={[
            { value: 'manual-first', label: '手动优先（未接 API）' },
            { value: 'aliyun-qwen35b-vision', label: '阿里云百炼 Qwen3.6 Flash 视觉/文本' },
            { value: 'aliyun-qwen-ocr', label: '阿里云百炼 Qwen OCR' },
            { value: 'aliyun-qwen-vl', label: '阿里云百炼 Qwen VL 多模态' },
            { value: 'bigmodel-vision', label: '智谱 BigModel 视觉模型' },
            { value: 'custom-vision-api', label: '客户自有视觉 API' },
          ]}
        />
      </Form.Item>
      <Form.Item label="视觉 API Endpoint" name={['recognition', 'endpoint']}>
        <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" />
      </Form.Item>
      <Form.Item label="模型名" name={['recognition', 'modelName']}>
        <Input placeholder="qwen3.6-flash" />
      </Form.Item>
      <Form.Item label="鉴权 Header" name={['recognition', 'authHeaderName']}>
        <Input placeholder="Authorization" />
      </Form.Item>
      <Form.Item label="密钥引用/环境变量名" name={['recognition', 'apiKeyRef']} extra="不要填写明文 key；这里填写后端或本地网关能读取到的引用名。">
        <Input placeholder="DASHSCOPE_API_KEY" />
      </Form.Item>
      <Form.Item label="系统提示词" name={['recognition', 'promptSystem']}>
        <TextArea autoSize={{ minRows: 7, maxRows: 12 }} />
      </Form.Item>
      <Form.Item label="用户提示词模板" name={['recognition', 'promptUserTemplate']}>
        <TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
      </Form.Item>
      <Form.Item label="输出合同" name={['recognition', 'outputContract']}>
        <Select
          mode="multiple"
          options={[
            { value: 'problemText', label: '题文' },
            { value: 'givenConditions', label: '已知条件' },
            { value: 'answerTarget', label: '求解目标' },
            { value: 'mathSymbolProtection', label: '数学符号保护' },
          ]}
        />
      </Form.Item>
      <Form.Item label="无图文字题处理" name={['recognition', 'textMode']}>
        <Select
          options={[
            { value: 'same-frame', label: '进入同一个题目内容框' },
            { value: 'manual-only', label: '仅手动编辑' },
          ]}
        />
      </Form.Item>
      <Form.Item
        label="上传后自动识别题图"
        name={['recognition', 'autoNextAfterRecognized']}
        valuePropName="checked"
        extra="只自动发起识别并填入候选题文；是否跳过确认由审核闸门统一控制。"
      >
        <Switch checkedChildren="自动识别" unCheckedChildren="手动识别" />
      </Form.Item>
      <Tag color="blue">recognition-ai-config</Tag>
      <Text type="secondary">
        这里只保存配置引用，不保存明文 API Key。客户定制可以用客户自己的 key，但真实调用必须走本地服务或后端网关，避免密钥暴露在前端。
      </Text>
    </div>
  );
}

// @xiaxia-settings-hint: vectorKb is saved config only until /api/agent/script-board accepts it; keep this UI marked as reserved.
function VectorKbSettings() {
  return (
    <div>
      <Alert
        description="这里先保存 Agent 检索配置；当前 /api/agent/script-board 还没有读取 vectorKb，所以不要把这里理解为已经接通知识库检索。"
        message="预留配置：保存但不参与当前 Agent 请求"
        showIcon
        type="warning"
      />
      <Form.Item label="启用知识库检索" name={['vectorKb', 'enabled']} valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="关闭" />
      </Form.Item>
      <Form.Item label="知识库 Provider" name={['vectorKb', 'provider']}>
        <Select
          options={[
            { value: 'none', label: '不使用' },
            { value: 'builtin', label: '内置知识库' },
            { value: 'local', label: '本地知识库' },
            { value: 'external-vector-api', label: '外部向量 API' },
            { value: 'customer-managed', label: '客户自管知识库' },
          ]}
        />
      </Form.Item>
      <Form.Item label="知识库 Endpoint" name={['vectorKb', 'endpoint']}>
        <Input placeholder="https://example.com/vector/search" />
      </Form.Item>
      <Form.Item label="密钥引用/环境变量名" name={['vectorKb', 'apiKeyRef']} extra="只保存引用名，不保存明文 key。">
        <Input placeholder="VECTOR_KB_API_KEY" />
      </Form.Item>
      <Form.Item label="Collection" name={['vectorKb', 'collection']}>
        <Input placeholder="math-whiteboard" />
      </Form.Item>
      <Form.Item label="Embedding 模型" name={['vectorKb', 'embeddingModel']}>
        <Input placeholder="text-embedding-v4" />
      </Form.Item>
      <Form.Item label="Top K" name={['vectorKb', 'topK']}>
        <InputNumber min={1} max={20} step={1} />
      </Form.Item>
      <Tag color="orange">reserved-vector-kb-config</Tag>
    </div>
  );
}

function ScriptAgentSettings() {
  return (
    <div>
      <Alert
        showIcon
        type="info"
        message="Agent 对话参数必须跟随 A-template 命名合同"
        description="promptSystem、promptUserTemplate、outputContract 都只服务 rows 候选稿：开场读题主身份是 A-template-open；为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位，当前 boardSlice 必须留空；分析题目和梳理总结可按需要填写 C 素材候选；正式步骤才用 A1/B1/C1。"
        style={{ marginBottom: 12 }}
      />
      <Form.Item label="Agent 模式" name={['scriptAgent', 'mode']}>
        <Select
          options={[
            { value: 'manual-template', label: '本地模板候选' },
            { value: 'builtin-kb', label: '内置知识库' },
            { value: 'external-agent-api', label: '阿里云百炼 / 外部 Agent API' },
            { value: 'customer-agent', label: '客户自有 Agent' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Agent API Endpoint" name={['scriptAgent', 'endpoint']}>
        <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" />
      </Form.Item>
      <Form.Item label="模型名" name={['scriptAgent', 'modelName']}>
        <Input placeholder="qwen3.6-flash" />
      </Form.Item>
      <Form.Item label="鉴权 Header" name={['scriptAgent', 'authHeaderName']}>
        <Input placeholder="Authorization" />
      </Form.Item>
      <Form.Item label="密钥引用/环境变量名" name={['scriptAgent', 'apiKeyRef']} extra="客户定制可使用客户自己的百炼或模型 key；这里保存引用名，不保存明文。">
        <Input placeholder="DASHSCOPE_API_KEY" />
      </Form.Item>
      <Form.Item
        label="系统提示词"
        name={['scriptAgent', 'promptSystem']}
        extra="必须写明 rows 合同和 A-template 命名边界，不能退回 spokenScript/boardPlan 或历史编号口径。"
      >
        <TextArea autoSize={{ minRows: 10, maxRows: 18 }} />
      </Form.Item>
      <Form.Item
        label="用户提示词模板"
        name={['scriptAgent', 'promptUserTemplate']}
        extra="模板里要保留 {{problemText}}，并提醒开场读题主身份是 A-template-open；为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位，当前 boardSlice 必须留空；分析题目和梳理总结可按需要填写 C 素材候选；正式步骤才生成 A1/B1/C1。"
      >
        <TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
      </Form.Item>
      <Form.Item label="输出合同" name={['scriptAgent', 'outputContract']} extra="当前只允许 rows；boardSlice 只是 C 素材候选，A 返回真实时长后再生成 B 寿命，不由 Agent 直接输出正式 A/B/C。">
        <Select
          mode="multiple"
          options={[
            { value: 'rows', label: 'rows 表格候选（template 命名合同）' },
          ]}
        />
      </Form.Item>
      <Tag color="geekblue">script-agent-prompt</Tag>
      <Text type="secondary">
        Agent 只产 rows 候选稿；用户确认应用后才写入正式文稿和允许生成的 C 素材候选，再进入 A 轨语音步骤。
      </Text>
    </div>
  );
}

const canvasPresetOptions: Array<{ label: string; value: AppConfig['stageDefaults']['canvas']['preset']; width: number; height: number }> = [
  { height: 1080, label: '横屏 16:9｜1920 × 1080', value: 'landscape-1080p', width: 1920 },
  { height: 720, label: '横屏 16:9｜1280 × 720', value: 'landscape-720p', width: 1280 },
  { height: 768, label: '课堂 4:3｜1024 × 768', value: 'classic-4-3', width: 1024 },
  { height: 1920, label: '竖屏 9:16｜1080 × 1920', value: 'portrait-1080p', width: 1080 },
  { height: 1080, label: '方屏 1:1｜1080 × 1080', value: 'square-1080', width: 1080 },
  { height: 1080, label: '自定义', value: 'custom', width: 1920 },
];

function CanvasSettings({ form }: { form: FormInstance<AppConfig> }) {
  return (
    <div>
      <Alert
        showIcon
        type="info"
        title="这里是新工程默认值"
        description="这里保存新工程画布规格和背景默认值；当前工程舞台尺寸在右侧画布面板调整，当前 C 素材字体在“C 默认字体 / 当前工程”调整。"
      />
      <Form.Item label="默认画布规格" name={['stageDefaults', 'canvas', 'preset']}>
        <Select
          options={canvasPresetOptions.map((option) => ({ label: option.label, value: option.value }))}
          onChange={(value) => {
            const preset = canvasPresetOptions.find((option) => option.value === value);
            if (!preset || preset.value === 'custom') {
              return;
            }
            form.setFieldsValue({
              stageDefaults: {
                ...form.getFieldValue('stageDefaults'),
                canvas: {
                  ...form.getFieldValue(['stageDefaults', 'canvas']),
                  height: preset.height,
                  preset: preset.value,
                  width: preset.width,
                },
              },
            });
          }}
        />
      </Form.Item>
      <div className="inspector-field-grid">
        <Form.Item label="默认宽度" name={['stageDefaults', 'canvas', 'width']}>
          <InputNumber max={3840} min={360} step={10} />
        </Form.Item>
        <Form.Item label="默认高度" name={['stageDefaults', 'canvas', 'height']}>
          <InputNumber max={3840} min={360} step={10} />
        </Form.Item>
      </div>
      <Form.Item label="默认背景色" name={['stageDefaults', 'canvas', 'background']}>
        <Input placeholder="#ffffff" />
      </Form.Item>
    </div>
  );
}

function TypographySettings() {
  return (
    <div>
      <Alert
        description="保存后只影响以后新建工程的默认 C 素材字体；不会覆盖当前舞台。C 素材字体地址允许填写 HTTPS 在线字体 CSS，留空则使用项目内置/本机字体。"
        message="这里是新工程默认值，不是当前工程字体入口"
        showIcon
        type="info"
      />
      <Form.Item label="界面字体策略（不控制 C 素材）" name={['typography', 'globalFontPreset']}>
        <Select
          options={[
            { value: 'system', label: '系统默认' },
            { value: 'math-first', label: '数学符号优先' },
          ]}
        />
      </Form.Item>
      <BoardTypographyFormFields
        helpText="这里只保存以后新建工程使用的默认值；当前工程请在右侧“C 默认字体 / 当前工程”中调整并应用。在线字体请填 HTTPS 字体 CSS。"
        labelPrefix="新工程默认 C 素材"
        namePrefix={['stageDefaults', 'canvas']}
      />
    </div>
  );
}

function EffectSettings() {
  return (
    <div>
      <Form.Item label="默认 C 素材出现方式" name={['effects', 'boardRevealEffect']}>
        <Select
          options={[
            { value: 'write-on', label: '描写出现' },
            { value: 'fade-in', label: '淡入' },
            { value: 'pop', label: '轻弹出' },
          ]}
        />
      </Form.Item>
      <Form.Item label="预留 C 素材透明度（%）" name={['effects', 'defaultStickerOpacity']} extra="当前只保存默认配置，不改变 A 轨 timing 或 B 寿命。">
        <InputNumber min={0} max={100} />
      </Form.Item>
    </div>
  );
}

function FileSettings() {
  return (
    <div>
      <Form.Item label="默认保存位置标识" name={['output', 'defaultSaveDirectoryLabel']}>
        <Input placeholder="由用户选择的保存位置名称，不写死本机路径" />
      </Form.Item>
      <Form.Item label="文件命名模板" name={['output', 'fileNameTemplate']}>
        <Input placeholder="{{projectTitle}}-{{date}}" />
      </Form.Item>
      <Form.Item label="录制格式" name={['output', 'recordingFormat']}>
        <Select
          options={[
            { value: 'webm', label: 'WebM（浏览器原生）' },
            { value: 'mp4', label: 'MP4（后续转码）' },
          ]}
        />
      </Form.Item>
      <div className="inspector-field-grid">
        <Form.Item label="录制帧率" name={['output', 'recordingFps']}>
          <InputNumber max={60} min={12} step={1} />
        </Form.Item>
        <Form.Item label="录制质量" name={['output', 'recordingQuality']}>
          <InputNumber max={1} min={0.1} step={0.01} />
        </Form.Item>
      </div>
      <Form.Item label="导出后写入交付记录" name={['output', 'writeExportResultAsset']} valuePropName="checked">
        <Switch checkedChildren="写入" unCheckedChildren="只下载" />
      </Form.Item>
      <Text type="secondary">这里保存导出偏好；真正的导出文件以后写入 exportResult，不混到 A 轨音频里。</Text>
    </div>
  );
}

