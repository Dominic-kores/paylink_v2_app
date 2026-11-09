
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

export default function PaymentChart({ data = [] }) {
  return (
    <div className="chart-card">
      <h3>Revenue — Last 7 Days</h3>

      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={(value) => value.slice(5)}
            />

            <YAxis />

            <Tooltip
              formatter={(value) => [
                `KES ${Number(value).toLocaleString("en-KE")}`,
                "Revenue"
              ]}
            />

            <Bar
              dataKey="amount"
              fill="#138a4a"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
