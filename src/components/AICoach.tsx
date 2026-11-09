import { useRef, useState } from "react";
import { Copy } from "lucide-react";
import { coachTopics, coachPrompt } from "../lib/coachPrompts";
export function AICoach({ summary }: { summary: string }) {
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
    <section className="panel ai-coach" aria-label="AI 個人化理財教練">
      <span className="eyebrow">LEARN & TAKE ACTION</span>
      <h3>AI 個人化理財教練</h3>
      <p>
        讓 AI
        根據你的家庭收支資料，找出財務風險、分析消費習慣，並提出具體可執行的理財改善方案。
      </p>
      <p className="hint">
        先填寫家庭預算，再複製資料與分析任務，貼到你選擇的 AI
        工具。教練以嚴格但尊重的方式分析；本網站不直接產生 AI 回答，AI
        的計算與建議仍需核對。
      </p>
      <div className="coach-grid">
        {coachTopics.map((topic) => (
          <button
            className="coach-card"
            key={topic.id}
            disabled={busy}
            onClick={() => copy(coachPrompt(summary, topic.id), topic.title)}
          >
            <Copy size={17} aria-hidden="true" />
            <span>複製 Prompt｜{topic.title}</span>
          </button>
        ))}
      </div>
      <button
        className="scenario-button"
        disabled={busy}
        onClick={() => copy(summary, "完整家庭收支摘要")}
      >
        複製完整家庭收支摘要
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
