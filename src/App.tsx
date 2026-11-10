import type {
  MonthlyTransfer,
  RetirementTransfer,
} from "./lib/savingsComparison";
import type { BudgetTransfer } from "./lib/retirementPlanning";
import { useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  FlaskConical,
  Target,
  TrendingUp,
  Wallet,
  Sunset,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import Goal from "./pages/Goal";
import Compound from "./pages/Compound";
import Budget from "./pages/Budget";
import Retirement from "./pages/Retirement";
const modules = [
  {
    title: "目標倒推",
    subtitle: "從想要的未來，算出現在的每一步。",
    question: "離目標，還有多遠？",
    icon: Target,
    tag: "01 / GOAL",
    component: Goal,
  },
  {
    title: "長期複利",
    subtitle: "讓本金、時間與假設報酬，一起說話。",
    question: "每月投入，未來能累積多少？",
    icon: TrendingUp,
    tag: "02 / GROWTH",
    component: Compound,
  },
  {
    title: "家庭預算",
    subtitle: "照顧日常，也為旅行與生活目標留白。",
    question: "生活與目標，如何取得平衡？",
    icon: Wallet,
    tag: "03 / BALANCE",
    component: Budget,
  },
  {
    title: "退休提領",
    subtitle: "理解提領與風險，規劃下一段自由。",
    question: "退休後，資產能陪你多久？",
    icon: Sunset,
    tag: "04 / FREEDOM",
    component: Retirement,
  },
];
export default function App() {
  const budgetSnapshot = useRef<BudgetTransfer | undefined>(undefined);
  const [page, setPage] = useState<number | null>(null);
  const [compoundTransfer, setCompoundTransfer] = useState<MonthlyTransfer>();
  const [retirementTransfer, setRetirementTransfer] =
    useState<RetirementTransfer>();
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => setPage(null)}
            aria-label="我的理財實驗室首頁"
          >
            <span className="brand-icon">
              <FlaskConical size={22} />
            </span>
            <span>
              我的理財實驗室<small>FINANCIAL LITERACY LAB</small>
            </span>
          </button>
          <span className="header-caption">把數字看懂，把未來想清楚。</span>
          <span className="private">
            <ShieldCheck size={15} />
            私密・免費・免登入
          </span>
        </div>
      </header>
      <main>
        {page === null ? (
          <>
            <section className="landing-hero">
              <div className="hero-copy">
                <span className="eyebrow">
                  <span className="status-dot" /> 為生活而學的理財練習
                </span>
                <h1>
                  未來的生活，
                  <br />
                  從今天的<span>一點理解</span>開始。
                </h1>
                <p>
                  不用懂艱深的金融術語。從一個目標、一筆投入，
                  <br className="desktop-break" />
                  看懂每個選擇如何影響你的財務未來。
                </p>
                <button className="primary-button" onClick={() => setPage(0)}>
                  開始我的第一個計畫
                  <ArrowUpRight size={19} />
                </button>
                <div className="hero-footnote">
                  <ShieldCheck size={16} />
                  試算留在瀏覽器；家庭資料僅本機暫存，可隨時清除。
                </div>
              </div>
              <div
                className="hero-art"
                aria-label="示意圖：本金與時間累積，非實際投資預測"
              >
                <span className="orbit orbit-one" />
                <span className="orbit orbit-two" />
                <div className="art-label">SMALL STEPS. BIG POSSIBILITIES.</div>
                <div className="growth-card">
                  <div className="growth-card-heading">
                    <span>每一小步，都算數</span>
                    <TrendingUp size={19} />
                  </div>
                  <div className="art-number">
                    你的未來<span>由今天開始累積</span>
                  </div>
                  <div className="art-bars">
                    {[20, 29, 37, 49, 59, 74, 91].map((h, i) => (
                      <span style={{ height: `${h}%` }} key={i} />
                    ))}
                  </div>
                  <div className="art-axis">
                    <span>今天</span>
                    <span>更有方向的未來</span>
                  </div>
                </div>
                <div className="floating-card">
                  <span className="floating-icon">
                    <Target size={22} />
                  </span>
                  <div>
                    目標可以很大<small>第一步可以很小</small>
                  </div>
                </div>
                <span className="art-disclaimer">概念示意，非報酬預測</span>
              </div>
            </section>
            <section className="tools-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">FOUR WAYS TO EXPLORE</span>
                  <h2>從你在意的問題開始</h2>
                </div>
                <p>四個工具，陪你練習更清楚的財務選擇。</p>
              </div>
              <div className="tool-grid">
                {modules.map((m, i) => (
                  <button
                    className="tool-card"
                    onClick={() => setPage(i)}
                    key={m.title}
                  >
                    <div className="tool-card-top">
                      <span className={`tool-icon tone-${i}`}>
                        <m.icon size={24} />
                      </span>
                      <ArrowUpRight size={20} />
                    </div>
                    <span className="eyebrow">{m.tag}</span>
                    <h3>{m.title}</h3>
                    <p>{m.subtitle}</p>
                    <span className="card-link">
                      開始探索
                      <ArrowRight size={15} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <div className="education-note">
              <FlaskConical size={24} />
              <div>
                <strong>這裡沒有標準答案，只有更清楚的理解。</strong>
                <p>
                  試算是一種練習。調整假設、比較情境，找到適合繼續思考的問題。
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <button className="back-button" onClick={() => setPage(null)}>
              <ArrowLeft size={16} />
              所有工具
            </button>
            <div className="page-heading">
              <div>
                <span className="eyebrow">{modules[page].tag}</span>
                <h1>{modules[page].title}</h1>
                <p>{modules[page].question}</p>
              </div>
              <span className="page-icon">
                {(() => {
                  const Icon = modules[page].icon;
                  return <Icon size={35} />;
                })()}
              </span>
            </div>
            <nav className="module-nav" aria-label="理財工具">
              {modules.map((m, i) => (
                <button
                  key={m.title}
                  aria-current={page === i ? "page" : undefined}
                  onClick={() => setPage(i)}
                >
                  <m.icon size={17} />
                  {m.title}
                </button>
              ))}
            </nav>
            {modules.map((m, i) => (
              <div key={m.title} hidden={page !== i}>
                {i === 1 ? (
                  <Compound
                    incoming={compoundTransfer}
                    onConsumed={() => setCompoundTransfer(undefined)}
                    onRetirement={(data) => {
                      setRetirementTransfer(data);
                      setPage(3);
                    }}
                  />
                ) : i === 2 ? (
                  <Budget
                    onSnapshot={(snapshot) => {
                      budgetSnapshot.current = snapshot;
                    }}
                    onOpenRetirement={() => setPage(3)}
                    onCompound={(monthly) => {
                      setCompoundTransfer({ monthly });
                      setPage(1);
                    }}
                  />
                ) : i === 3 ? (
                  <Retirement
                    getBudget={() => budgetSnapshot.current}
                    incoming={retirementTransfer}
                    onConsumed={() => setRetirementTransfer(undefined)}
                  />
                ) : (
                  <m.component />
                )}
              </div>
            ))}
          </>
        )}
      </main>
      <footer>
        <div className="footer-brand">
          <FlaskConical size={18} />
          我的理財實驗室<span>讓財務選擇，多一點理解。</span>
        </div>
        <p>
          僅供財務教育與情境試算，不構成投資建議。假設報酬不代表實際績效，也不保證退休安全。
        </p>
        <span>
          以 NT$ 新臺幣試算 · 不串接即時行情 · 家庭資料僅本機暫存，可清除
        </span>
      </footer>
    </>
  );
}
