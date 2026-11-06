export const livingFields = [
  { id: "food", name: "伙食", group: "needs", color: "#71917a" },
  { id: "rent", name: "房租與居住費", group: "needs", color: "#739883" },
  { id: "child", name: "育兒與家庭", group: "needs", color: "#a7bc94" },
  { id: "insurance", name: "保險", group: "needs", color: "#8488a7" },
  { id: "transport", name: "交通", group: "needs", color: "#789ca4" },
  { id: "utilities", name: "水電", group: "needs", color: "#b7aa7b" },
  { id: "medical", name: "醫藥費", group: "needs", color: "#82aaa3" },
  { id: "telecom", name: "電信費", group: "needs", color: "#9b9ac3" },
  {
    id: "householdGoods",
    name: "日用品與居家消耗品",
    group: "needs",
    color: "#91a998",
  },
  { id: "education", name: "教育與學習", group: "needs", color: "#829da6" },
  { id: "homeRepair", name: "居家維修", group: "needs", color: "#a09b80" },
  { id: "otherLiving", name: "其他生活支出", group: "needs", color: "#91a38b" },
  { id: "clothing", name: "治裝費", group: "wants", color: "#af91a8" },
  { id: "dining", name: "餐廳與日常娛樂", group: "wants", color: "#d2aa8c" },
  { id: "parentSupport", name: "孝親費", group: "wants", color: "#a6a1c1" },
  {
    id: "subscriptions",
    name: "工具與娛樂訂閱",
    group: "wants",
    color: "#c397a6",
  },
  { id: "gifts", name: "人情與禮金", group: "wants", color: "#bd9c8c" },
  { id: "beauty", name: "美容與個人保養", group: "wants", color: "#b694a8" },
  { id: "fitness", name: "運動與健身", group: "wants", color: "#869db7" },
] as const;
export type LivingGroup = "needs" | "wants";
export interface LivingCost {
  id: string;
  name: string;
  group: LivingGroup;
  value: number;
  color: string;
  flow: "living";
}
