import { useRef, useState } from "react";
import { Copy } from "lucide-react";
import { coachTopics, coachPrompt } from "../lib/coachPrompts";
export function AICoach({
  summary,
  planningPrompt,
}: {
  summary: string;
  planningPrompt?: string;
}) {
  const [status, setStatus] = useState(""),
    [failed, setFailed] = useState(false),
    [fallbackText, setFallbackText] = useState("");
  const copying = useRef(false);
  const [busy, setBusy] = useState(false);
  async function copy(text: string, title: string) {
    if (copying.current) return;
    copying.current = true;
    setBusy(true);
    setFailed(false);
    setStatus(`正在複製：${title}`);
    setFallbackText(text);
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`已複製：${title}`);
    } catch {
      setFailed(true);
      setStatus(
        `無法複製：${title}。請允許瀏覽器剪貼簿權限，或展開下方文字手動選取複製。`,
      );
    } finally {
      copying.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="panel ai-coach"
      aria-label={planningPrompt ? "AI 退休與轉職規劃" : "AI 個人化理財教練"}
    >
      <span className="eyebrow">LEARN & TAKE ACTION</span>
      <h3>{planningPrompt ? "AI 退休與轉職規劃" : "AI 個人化理財教練"}</h3>
      <p>
        {planningPrompt
          ? "整理退休提領、家庭責任與職涯資料，產生退休與轉職分析任務。"
          : "讓 AI 根據完整家庭收支資料，評估風險、消費與投資能力。"}
      </p>
      <p className="hint">
        複製完整資料與 Prompt，貼到 ChatGPT 或 Gemini。本站不直接產生 AI
        回答，也不會自動傳送資料；請核對 AI 計算與建議。
      </p>
      <div className="coach-grid">
        {(planningPrompt
          ? [{ title: "AI 退休與轉職規劃", text: planningPrompt }]
          : coachTopics.map((topic) => ({
              title: topic.title,
              text: coachPrompt(summary, topic.id),
            }))
        ).map((topic) => (
          <button
            className="coach-card"
            key={topic.title}
            disabled={busy}
            onClick={() => copy(topic.text, topic.title)}
          >
            <Copy size={17} aria-hidden="true" />
            <span>複製 Prompt｜{topic.title}</span>
          </button>
        ))}
      </div>
      <button
        className="scenario-button"
        disabled={busy}
        onClick={() =>
          copy(
            summary,
            planningPrompt ? "完整退休與轉職摘要" : "完整家庭收支摘要",
          )
        }
      >
        {planningPrompt ? "複製完整退休與轉職摘要" : "複製完整家庭收支摘要"}
      </button>
      <p role="status" aria-live="polite">
        {status}
      </p>
      {failed && (
        <details className="coach-fallback">
          <summary>展開待複製文字</summary>
          <textarea
            aria-label="待複製文字"
            readOnly
            value={fallbackText}
            onFocus={(e) => e.currentTarget.select()}
          />
        </details>
      )}
      <p className="reference-disclaimer">
        複製內容可能包含個人家庭財務資訊。貼到 AI
        工具前，請先檢查並移除不想分享的資料。本網站不會自動傳送你的家庭預算。
      </p>
    </section>
  );
}
