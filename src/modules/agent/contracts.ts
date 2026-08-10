export type AgentAction = {
  type: string;
  id?: string | number;
  data?: Record<string, unknown>;
};

export type TaskRequest = {
  prompt: string;
  conversation_id?: string | null;
  context?: Record<string, unknown>;
  auto_execute?: boolean;
};

export type TaskResult = {
  provider: string;
  ok: boolean;
  output: string;
  error?: string;
  duration_ms: number;
  workspace: string;
};

export type ReviewResult = {
  approved: boolean;
  report: string;
  actions: AgentAction[];
};

export type AgentResult = {
  task: TaskRequest;
  execution: TaskResult | null;
  review: ReviewResult | null;
  status: "completed" | "blocked" | "failed";
};
