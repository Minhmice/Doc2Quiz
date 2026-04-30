import { Card } from "@/components/ui/card"

interface WeeklyActivityChartProps {
  daily: Array<{ date: string; count: number }>
  totalAnswered: number
}

export function WeeklyActivityChart({ daily, totalAnswered }: WeeklyActivityChartProps) {
  const maxDay = Math.max(...daily.map((d) => d.count), 1)
  const today = new Date().toISOString().split("T")[0]
  const showNumbers = maxDay < 5

  if (totalAnswered === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-4">Weekly Activity</h3>
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          No activity this week — complete study sessions to see your progress
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium mb-4">Weekly Activity</h3>
      <div className="relative">
        {/* Grid background */}
        <div className="absolute inset-0 bg-muted/20 rounded" 
             style={{
               backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 24px, hsl(var(--border) / 0.1) 24px, hsl(var(--border) / 0.1) 25px)',
             }} 
        />
        
        {/* Chart container */}
        <div className="relative flex items-end justify-between gap-2 h-32 px-2 py-2">
          {daily.map((day) => {
            const heightPercent = maxDay > 0 ? (day.count / maxDay) * 100 : 0
            const isToday = day.date === today
            
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                {/* Bar */}
                <div
                  className={`w-full rounded-t transition-all ${
                    isToday 
                      ? "bg-primary ring-2 ring-primary ring-offset-2" 
                      : "bg-primary/70 hover:bg-primary"
                  }`}
                  style={{ height: `${Math.max(heightPercent, 2)}%` }}
                  title={`${day.date}: ${day.count} item${day.count !== 1 ? "s" : ""}`}
                >
                  {showNumbers && day.count > 0 && (
                    <div className="text-[10px] text-primary-foreground font-medium text-center pt-1">
                      {day.count}
                    </div>
                  )}
                </div>
                
                {/* Day label */}
                <div className={`text-[10px] ${isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Baseline */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      </div>
    </Card>
  )
}
