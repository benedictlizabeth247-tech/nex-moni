"use server"
/**
 * @fileOverview An AI-powered financial advisor that provides personalized tips based on user spending patterns and financial goals.
 * Powered by the Vercel AI SDK + AI Gateway.
 *
 * - getPersonalizedFinancialAdvice - A function that handles the generation of financial advice.
 * - PersonalizedFinancialAdviceInput - The input type for the getPersonalizedFinancialAdvice function.
 * - PersonalizedFinancialAdviceOutput - The return type for the getPersonalizedFinancialAdvice function.
 */

import { generateObject } from "ai"
import { z } from "zod"

const PersonalizedFinancialAdviceInputSchema = z.object({
  spendingPatterns: z
    .string()
    .describe("A detailed description of the user's recent spending habits, categories, and any significant transactions."),
  currentBalance: z.number().describe("The user's current available balance in NGN."),
  financialGoals: z
    .string()
    .describe("The user's stated financial goals, such as saving for a house, retirement, debt repayment, or specific investments."),
})
export type PersonalizedFinancialAdviceInput = z.infer<typeof PersonalizedFinancialAdviceInputSchema>

const PersonalizedFinancialAdviceOutputSchema = z.object({
  summary: z.string().describe("A concise summary of the overall financial advice provided."),
  tips: z.array(z.string()).describe("An array of specific, actionable personalized financial tips and strategies."),
})
export type PersonalizedFinancialAdviceOutput = z.infer<typeof PersonalizedFinancialAdviceOutputSchema>

export async function getPersonalizedFinancialAdvice(
  input: PersonalizedFinancialAdviceInput,
): Promise<PersonalizedFinancialAdviceOutput> {
  const parsed = PersonalizedFinancialAdviceInputSchema.parse(input)

  const { object } = await generateObject({
    model: "openai/gpt-5.4-mini",
    schema: PersonalizedFinancialAdviceOutputSchema,
    prompt: `You are the NexTips Advisor, an AI-powered financial expert for Nex Monie users. Your goal is to analyze the user's financial situation and provide personalized, actionable financial tips and strategies.
Focus on suggestions for automated daily savings, consistent wealth growth, and improving overall financial health.

Use the following information to generate your advice:

Current Available Balance: ₦${parsed.currentBalance}
Financial Goals: ${parsed.financialGoals}
Spending Patterns: ${parsed.spendingPatterns}

Based on this information, please provide a summary of your advice and an array of specific, personalized tips. Ensure the tips are practical and directly address the user's spending patterns and goals.`,
  })

  return object
}
