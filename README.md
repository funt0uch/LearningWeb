# LearningWeb

LearningWeb 是一个本地优先的 AI 学习闭环平台原型：本地资料管理、PDF 预览、OCR、错题整理、AI 解析、知识点统计、再练与判分、推荐与图谱、学习记录、数据看板和周报都围绕同一条学习流程展开。

## 目录结构

- `api/`：FastAPI 后端，负责本地文件、JSON 数据、错题整理、学习统计和 LLM 调用。
- `learning-web/`：Next.js 前端，包含登录页、首页、学习工作台、看板、设置和错题详情页。
- `data/`：本地运行数据目录，包括资料索引、学习记录、错题结果和上传文件。
- `scripts/`：本地开发启动/停止脚本。

## 技术栈

- 后端：FastAPI、Pydantic v2、PyMuPDF、可选 PaddleOCR。
- 前端：Next.js App Router、React、Tailwind、Recharts、Lucide Icons。
- 存储：本地 JSON 文件，便于课程演示和后续迁移。
- LLM：抽象 `LLMProvider`，默认适配火山方舟豆包并支持多模态输入。

## 本地运行

推荐使用 PowerShell 脚本启动：

```powershell
$env:ARK_API_KEY="你的豆包 API Key"
.\scripts\start-dev.ps1
```

停止服务：

```powershell
.\scripts\stop-dev.ps1
```

启动后访问：

- 前端登录页：http://127.0.0.1:3000/login
- 学习工作台：http://127.0.0.1:3000/workspace
- 后端文档：http://127.0.0.1:8000/docs
- 健康检查：http://127.0.0.1:8000/api/health

也可以手动启动。

后端：

```powershell
cd E:\LearningWeb\api
$env:ARK_API_KEY="你的豆包 API Key"
$env:DOUBAO_TIMEOUT_S="60"
E:\Conda\Anaconda3\Scripts\conda.exe run -n fastapi_env python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

前端：

```powershell
cd E:\LearningWeb\learning-web
$env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8000"
npm.cmd run dev:local
```

## 产品路由

- `/home`：项目首页。
- `/workspace`：学习工作台，包含资料库、PDF 预览、报告生成和 AI 助手。
- `/dashboard`：学习数据看板。
- `/settings`：运行状态、模型选择和偏好配置。
- `/wrong/[itemId]`：错题详情、相似题和再练判分。
- `/library`：兼容旧路由，自动跳转到 `/workspace`。

## 关键环境变量

- `ARK_API_KEY`：豆包/火山方舟 API Key。
- `DOUBAO_API_KEY`：备用 API Key 变量名，优先级低于 `ARK_API_KEY`。
- `DOUBAO_BASE_URL`：方舟 OpenAI 兼容接口地址，默认 `https://ark.cn-beijing.volces.com/api/v3`。
- `DOUBAO_MODEL`：模型名，默认 `doubao-seed-2-0-pro-260215`。
- `DOUBAO_TIMEOUT_S`：LLM 请求超时秒数，默认 `30`。
- `LEARNINGWEB_DATA_ROOT`：本地数据目录，默认 `E:\LearningWeb\data`。
- `LEARNINGWEB_MAX_UPLOAD_MB`：单文件上传上限，默认 `80`。
- `NEXT_PUBLIC_API_BASE`：前端访问后端的基础地址。

## 核心接口

- `GET /api/health`：运行健康检查。
- `GET/PUT /api/folders-state`：资料目录树读写。
- `POST /api/upload`：上传资料文件。
- `GET /api/files/{folder_id}`：读取文件夹下的资料列表。
- `GET/DELETE /api/file/{file_id}`：下载或删除文件。
- `POST /api/tasks/wrong-questions/from-pdf`：从 PDF 整理错题。
- `POST /api/chat`：AI 学习助手。
- `GET /api/knowledge/stats`：知识点统计。
- `GET /api/dashboard/overview`：数据看板聚合指标。
- `GET /api/reports/weekly`：学习周报。
- `GET/PUT /api/settings`：运行状态和偏好设置。

## 工程约定

- API Key 只通过环境变量注入，不能写进前端代码或仓库文件。
- 本地数据在 `data/` 下读写，上传文件会进入 `data/files/{folder_id}/`。
- 前端请求统一通过 `learning-web/src/lib/apiBase.ts` 处理，避免 URL 空格、尾部斜杠和 `localhost` 解析差异。
- 生成目录和日志文件已通过 `.gitignore` 忽略，避免提交 `.next*`、`__pycache__`、日志和临时文件。
