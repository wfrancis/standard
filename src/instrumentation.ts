export async function register() {
  if (process.env.AGENT_ENABLED === 'true' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAgentLoop } = await import('@/lib/agents/runner');
    startAgentLoop();
  }
}
