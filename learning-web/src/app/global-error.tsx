"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          background: "#f7f6f3",
          color: "#37352f",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>系统发生了未捕获错误</h1>
          <p style={{ marginTop: 12, lineHeight: 1.6, color: "#787774" }}>
            这通常是运行时异常或依赖未安装导致。你可以先重试，如果仍失败，请回到工作台重新进入。
          </p>
          <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: "none",
                background: "#2383e2",
                color: "white",
                padding: "10px 14px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              重试
            </button>
            <a
              href="/workspace"
              style={{
                display: "inline-block",
                border: "1px solid #e8e7e4",
                background: "white",
                color: "#37352f",
                padding: "10px 14px",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              返回工作台
            </a>
          </div>
          <pre
            style={{
              marginTop: 24,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12,
              color: "#5c5b57",
              background: "white",
              border: "1px solid #e8e7e4",
              padding: 12,
              borderRadius: 12,
            }}
          >
            {error?.message}
            {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        </div>
      </body>
    </html>
  );
}

