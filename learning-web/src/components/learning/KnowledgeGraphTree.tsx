"use client";

type Node = Record<string, unknown>;

function Leaf({ meta }: { meta: Record<string, unknown> }) {
  return (
    <span className="text-[12px] text-[var(--main-muted)]">
      <span className="text-[var(--main-fg)]">{String(meta.full_label ?? "")}</span>
      <span className="ml-2 tabular-nums">
        错题 {String(meta.wrong_count ?? 0)} · 难度 {String(meta.avg_difficulty ?? "-")}
      </span>
    </span>
  );
}

function Subtree({ data, depth }: { data: Node; depth: number }) {
  const branchKeys = Object.keys(data).filter((k) => k !== "_meta" && k !== "_rollup_meta");
  const meta = data._meta as Record<string, unknown> | undefined;

  if (branchKeys.length === 0 && meta) {
    return <Leaf meta={meta} />;
  }

  return (
    <ul
      className={`space-y-1 ${depth > 0 ? "ml-3 border-l border-[var(--border)] pl-3" : ""}`}
    >
      {branchKeys.map((k) => {
        const child = (typeof data[k] === "object" && data[k] !== null
          ? data[k]
          : {}) as Node;
        const rollup = child._rollup_meta as Record<string, unknown> | undefined;
        return (
          <li key={k} className="text-[13px] leading-snug">
            <span className="font-medium text-[var(--main-fg)]">{k}</span>
            {rollup ? (
              <span className="ml-2 text-[11px] text-[var(--main-muted)]">
                汇总 错{String(rollup.wrong_count ?? "")} · 难度≈
                {String(rollup.avg_difficulty ?? "")}
              </span>
            ) : null}
            <div className="mt-1">
              <Subtree data={child} depth={depth + 1} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function KnowledgeGraphTree({ data }: { data: Node }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-[12px] text-[var(--main-muted)]">暂无知识点层级数据</p>
    );
  }
  return <Subtree data={data} depth={0} />;
}
