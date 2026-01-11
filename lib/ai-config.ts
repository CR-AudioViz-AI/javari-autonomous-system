// lib/ai-config.ts
// EMERGENCY COST FIX - Force Haiku for all background tasks
// Created: 2026-01-11 15:23 UTC

export const AI_CONFIG = {
  // BACKGROUND TASKS: Use cheapest model ALWAYS
  CRON_MODEL: 'claude-haiku-4-20250120',  // $0.25/M tokens (12X cheaper than Sonnet)
  CRON_MAX_TOKENS: 1000,  // Keep responses short
  
  // USER-FACING: Use better model only when needed
  CHAT_MODEL: 'claude-haiku-4-20250120',  // Start with Haiku
  CHAT_MAX_TOKENS: 2000,
  
  // EXPENSIVE OPERATIONS: Require explicit opt-in
  PREMIUM_MODEL: 'claude-sonnet-4-5-20250929',  // $3/M tokens
  PREMIUM_MAX_TOKENS: 4000,
  
  // SPENDING LIMITS
  MAX_DAILY_SPEND: 5.00,  // $5/day maximum
  ALERT_THRESHOLD: 3.00,   // Alert at $3/day
  
  // ANTHROPIC PRICING (for reference)
  PRICING: {
    'claude-haiku-4-20250120': 0.25,      // $0.25 per million tokens
    'claude-sonnet-4-5-20250929': 3.00,   // $3.00 per million tokens
    'claude-opus-4-20250514': 15.00,      // $15.00 per million tokens
  }
} as const;

export function getModelForTask(taskType: 'cron' | 'chat' | 'premium' = 'cron') {
  switch(taskType) {
    case 'cron':
      return {
        model: AI_CONFIG.CRON_MODEL,
        max_tokens: AI_CONFIG.CRON_MAX_TOKENS,
      };
    case 'chat':
      return {
        model: AI_CONFIG.CHAT_MODEL,
        max_tokens: AI_CONFIG.CHAT_MAX_TOKENS,
      };
    case 'premium':
      return {
        model: AI_CONFIG.PREMIUM_MODEL,
        max_tokens: AI_CONFIG.PREMIUM_MAX_TOKENS,
      };
    default:
      // Default to cheapest for safety
      return {
        model: AI_CONFIG.CRON_MODEL,
        max_tokens: AI_CONFIG.CRON_MAX_TOKENS,
      };
  }
}

// Utility to estimate cost
export function estimateCost(tokens: number, model: string): number {
  const pricePerMillion = AI_CONFIG.PRICING[model as keyof typeof AI_CONFIG.PRICING] || 3.00;
  return (tokens / 1_000_000) * pricePerMillion;
}
