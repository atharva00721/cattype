import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  ComposedChart,
} from 'recharts';
import { motion } from 'framer-motion';
import { useTypingStore, useAuthStore } from '@/lib/store';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodeSnippet } from '@/lib/code-snippets';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { SettingsDialog } from './settings-dialog';

interface TypingResultsProps {
  onRestart: () => void;
  snippet: CodeSnippet;
}

interface TooltipProps {
  active?: boolean;
  payload?: {
    name: string;
    value: number;
    stroke: string;
    dataKey: string;
  }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <p className="text-sm font-medium text-card-foreground mb-2">Time: {label}s</p>
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ 
                  backgroundColor: entry.name === 'wpm' 
                    ? 'hsl(var(--primary))' 
                    : entry.name === 'raw' 
                    ? 'hsl(var(--muted-foreground))'
                    : 'hsl(var(--destructive))'
                }}
              />
              <span className="text-sm capitalize text-card-foreground">
                {entry.name}: {Math.round(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function TypingResults({ onRestart, snippet }: TypingResultsProps) {
  const stats = useTypingStore((state) => state.stats);
  const resetStats = useTypingStore((state) => state.resetStats);
  const { session } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!stats.isComplete) return null;

  // Create data points only until completion time
  const time = stats.time || 0;
  const chartData = Array.from({ length: Math.ceil(time) }, (_, index) => {
    // Only include data points up to the actual completion time
    if (index + 1 > time) return null;
    return {
      time: index + 1,
      wpm: stats.wpm[index] || 0,
      raw: stats.raw[index] || 0,
      errors: stats.errors[index] || 0,
    };
  }).filter(Boolean);

  // Add the final data point at the exact completion time
  if (time && Math.floor(time) !== time) {
    chartData.push({
      time: time,
      wpm: stats.wpm[Math.floor(time)] || 0,
      raw: stats.raw[Math.floor(time)] || 0,
      errors: stats.errors[Math.floor(time)] || 0,
    });
  }

  const lastWPM = stats.wpm[stats.wpm.length - 1] || 0;
  const lastRaw = stats.raw[stats.raw.length - 1] || 0;
  const timeTaken = stats.time || 0;

  // Find max value for Y axis (only considering wpm and raw)
  const maxY = Math.max(
    ...stats.wpm,
    ...stats.raw
  );

  const formatCharacterStats = () => {
    return `${stats.characters.correct}/${stats.totalErrors}/${stats.characters.extra}/${stats.characters.missed}`;
  };

  const handleSave = async () => {
    if (!session?.user?.id) {
      setShowSettings(true);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/typing-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippetId: snippet.id,
          language: snippet.language,
          wpm: lastWPM,
          raw: lastRaw,
          accuracy: stats.accuracy,
          time: timeTaken,
          characters: {
            correct: stats.characters.correct,
            incorrect: stats.totalErrors,
            extra: stats.characters.extra,
            missed: stats.characters.missed,
          },
          testType: snippet.name,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to save results");
      }
      
      toast.success("Results saved successfully!");
    } catch (error) {
      console.error("Error saving results:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save results");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-6xl mx-auto p-6 space-y-6"
    >
      <SettingsDialog 
        open={showSettings} 
        onOpenChange={setShowSettings}
        showTrigger={false}
      />
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex flex-col gap-2">
          <div className="text-4xl font-mono">
            <span className="text-primary">{lastWPM}</span>
            <span className="text-muted-foreground text-2xl ml-2">wpm</span>
          </div>
          <div className="text-4xl font-mono">
            <span className="text-primary">{Math.round(stats.accuracy)}%</span>
            <span className="text-muted-foreground text-2xl ml-2">acc</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                test type
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-mono">
                <Badge variant="outline" className="gap-2">
                  <span>{snippet.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {snippet.language}
                  </span>
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                raw
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <div className="text-2xl font-mono text-primary">
                      {Math.round(lastRaw)}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Overall WPM: {lastWPM.toFixed(2)}</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                characters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <div className="text-xl font-mono text-primary">
                      {formatCharacterStats()}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">
                      correct/incorrect/extra/missed
                    </p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                time
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger>
                    <div className="text-2xl font-mono text-primary">
                      {Math.round(timeTaken)}s
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{timeTaken.toFixed(2)}s</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="w-full overflow-hidden bg-card/50">
        <CardContent className="p-6">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="rawGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="time"
                  stroke="currentColor"
                  opacity={0.5}
                  tickLine={false}
                  label={{ value: 'time (s)', position: 'bottom', offset: 0 }}
                />
                <YAxis 
                  stroke="currentColor" 
                  opacity={0.5} 
                  tickLine={false}
                  domain={[0, Math.ceil(maxY * 1.1)]}
                  label={{ value: 'wpm', angle: -90, position: 'insideLeft', offset: -10 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="wpm"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#wpmGradient)"
                  dot={false}
                  name="wpm"
                />
                <Area
                  type="monotone"
                  dataKey="raw"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#rawGradient)"
                  dot={false}
                  name="raw"
                />
                <Line
                  type="monotone"
                  dataKey="errors"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={false}
                  name="errors"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  resetStats();
                  onRestart();
                }}
                variant="outline"
                size="icon"
                className="shadow-none border-none"
              >
                <RotateCcw className="w-5 h-5 transition-transform hover:-rotate-90" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset the typing test</p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>

        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSave}
                variant="outline"
                size="icon"
                className="shadow-none border-none"
                disabled={isSaving}
              >
                <Save className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{session?.user ? "Save your results" : "Sign in to save results"}</p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      </div>
    </motion.div>
  );
} 