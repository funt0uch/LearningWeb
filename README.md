# LearningWeb（AI 学习平台原型）

一个可答辩、可演示的 AI 学习平台原型：本地资料管理 → PDF 预览 → OCR → 错题整理 → AI 解析 → 知识点统计 → 再练与判分 → 推荐与图谱 → 学习记录 → 数据看板与周报。

## 目录结构（关键）

- `api/`: FastAPI 后端（数据落本地 JSON）
- `learning-web/`: Next.js 前端（工作台/看板/设置/详情页）
- `data/`: 本地数据目录（运行时生成或读写）

## 技术栈

- **后端**: FastAPI、Pydantic v2、PyMuPDF、（可选）PaddleOCR
- **前端**: Next.js App Router、React、Tailwind、Recharts、Lucide Icons
- **存储**: 本地 JSON 文件（便于课程/答辩演示，不依赖数据库）
- **LLM**: 抽象 `LLMProvider`，默认适配火山方舟（豆包）并支持多模态

## 启动方式

### 1）启动后端（FastAPI）

进入 `api/` 目录，安装依赖并启动：

```bash
cd api
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

（可选）启用 OCR：

```bash
pip install -r requirements-ocr.txt
```

### 2）启动前端（Next.js）

进入 `learning-web/` 目录：

```bash
cd learning-web
npm install
npm run dev
```

## 产品路由

- `/home`: 项目首页（展示+入口）
- `/workspace`: 学习工作台（资料库、PDF/OCR、错题链路、AI Agent）
- `/dashboard`: 学习数据看板（Recharts）
- `/settings`: 运行状态与偏好配置
- `/wrong/[itemId]`: 错题详情 + 相似题 + 再练与判分

兼容旧路由：

- `/library` → 自动跳转到 `/workspace`

## 核心接口（后端）

- `POST /api/tasks/wrong-questions/from-pdf`: 从 PDF 整理错题（含重试、校验、去重、item_id）
- `POST /api/chat`: AI Agent 聊天（解释/总结/相似题等模式）
- `GET /api/knowledge/stats`: 知识点统计
- `GET /api/dashboard/overview`: 看板聚合数据
- `GET /api/reports/weekly`: 周报（LLM 成功 → 智能总结；失败 → 模板降级）
- `GET/PUT /api/settings`: 配置中心


