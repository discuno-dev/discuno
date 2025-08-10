'use server'

import { stripe } from '~/lib/stripe'

export interface TaxCalculationInput {
  amount: number // in cents
  currency: string
  address: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country: string
  }
  customerEmail?: string
}

export interface TaxCalculationResult {
  success: boolean
  taxAmount?: number // in cents
  totalAmount?: number // in cents (amount + tax)
  taxRate?: number // as percentage (e.g., 8.25 for 8.25%)
  error?: string
  calculationId?: string
}

/**
 * Calculate tax for a given amount and address using Stripe Tax
 */
export const calculateTax = async (input: TaxCalculationInput): Promise<TaxCalculationResult> => {
  try {
    const { amount, currency, address } = input

    // Create a tax calculation with Stripe
    const calculation = await stripe.tax.calculations.create({
      currency: currency.toLowerCase(),
      line_items: [
        {
          amount,
          reference: 'mentoring-session',
          // General electronic services
          tax_code: 'txcd_10000000',
        },
      ],
      customer_details: {
        address: {
          line1: address.line1 ?? '',
          line2: address.line2 ?? '',
          city: address.city ?? '',
          state: address.state ?? '',
          postal_code: address.postal_code ?? '',
          country: address.country,
        },
        address_source: 'billing',
      },
    })

    console.log('Tax calculation', calculation)

    const taxAmount = calculation.tax_amount_exclusive || 0
    const totalAmount = amount + taxAmount

    // Calculate tax rate as percentage
    let taxRate = 0
    if (amount > 0) {
      taxRate = (taxAmount / amount) * 100
    }

    return {
      success: true,
      taxAmount,
      totalAmount,
      taxRate: Math.round(taxRate * 100) / 100, // Round to 2 decimal places
      calculationId: calculation.id ?? undefined,
    }
  } catch (error) {
    console.error('Tax calculation failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tax calculation failed',
    }
  }
}

export const updatePaymentIntentAmount = async (params: {
  paymentIntentId: string
  amount: number // total amount including tax, in cents
  taxAmount: number // in cents
  subtotal: number // in cents
  calculationId: string
}) => {
  console.log('Updating payment intent amount', params)
  try {
    const { paymentIntentId, amount, taxAmount, subtotal, calculationId } = params
    await stripe.paymentIntents.update(paymentIntentId, {
      amount,
      metadata: {
        tax_calculation_id: String(calculationId),
        subtotal: String(subtotal),
        tax: String(taxAmount),
        total: String(amount),
      },
    })
    return { success: true as const }
  } catch (error) {
    console.error('Failed to update PaymentIntent amount with tax:', error)
    return { success: false as const, error: 'Failed to update total with tax' }
  }
}

export const createTaxTransaction = async (params: {
  calculationId: string
  paymentIntentId: string
}): Promise<{ success: true; transactionId: string } | { success: false; error: string }> => {
  try {
    const { calculationId, paymentIntentId } = params
    const transaction = await stripe.tax.transactions.createFromCalculation({
      calculation: calculationId,
      reference: paymentIntentId,
    })

    // Persist the created tax transaction id on the PaymentIntent for reporting/refunds
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        tax_transaction_id: transaction.id,
      },
    })

    return { success: true, transactionId: transaction.id }
  } catch (error) {
    console.error('Failed to create tax transaction from calculation:', error)
    return { success: false, error: 'Failed to create tax transaction' }
  }
}
