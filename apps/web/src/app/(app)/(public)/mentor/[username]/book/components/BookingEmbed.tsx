'use client'

import {
  AddressElement,
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { ArrowLeft, CalendarIcon, Clock, CreditCard } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type {
  BookingFormInput,
  TimeSlot,
} from '~/app/(app)/(public)/mentor/[username]/book/actions'
import type { BookingData } from '~/app/(app)/(public)/mentor/[username]/book/components/BookingModal'
import {
  calculateTax,
  updatePaymentIntentAmount,
} from '~/app/(app)/(public)/mentor/[username]/book/tax-actions'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { BadRequestError, ExternalApiError } from '~/lib/errors'
import { stripePromise } from '~/lib/stripe/client'
import {
  createStripePaymentIntent,
  fetchEventTypes as fetchEventTypesAction,
  fetchAvailableSlots as fetchSlotsAction,
  type EventType,
} from '../actions'

interface BookingFormData {
  name: string
  email: string
}

export const BookingEmbed = ({ bookingData }: { bookingData: BookingData }) => {
  const { calcomUsername } = bookingData
  const today = useMemo(() => new Date(), [])

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(today)
  const [currentMonth, setCurrentMonth] = useState(today)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<'calendar' | 'booking' | 'payment'>('calendar')
  const [formData, setFormData] = useState<BookingFormData>({
    name: '',
    email: '',
  })
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [monthlyAvailability, setMonthlyAvailability] = useState<Record<string, TimeSlot[]>>({})
  // Select today's date on initial load
  useEffect(() => {
    setSelectedDate(today)
  }, [today])

  const startMonth = startOfMonth(today)
  const endMonth = endOfMonth(addDays(today, 60))

  // Fetch event types
  const {
    data: eventTypes = [],
    isPending: eventTypesLoading,
    error: eventTypesError,
  } = useQuery({
    queryKey: ['event-types', calcomUsername],
    queryFn: () => fetchEventTypesAction(calcomUsername),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Use the selected event type
  const currentEventId = selectedEventType?.id

  const {
    data: availableSlots,
    isSuccess: isSlotsFetched,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['available-slots', currentEventId, format(currentMonth, 'yyyy-MM')],
    queryFn: () => {
      if (!currentEventId) throw new BadRequestError('No event type selected')
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      const startDate = startOfWeek(monthStart)
      const endDate = endOfWeek(monthEnd)
      return fetchSlotsAction(currentEventId, startDate, endDate, timeZone)
    },
    staleTime: 1000 * 60, // 1 minute
    enabled: currentStep === 'calendar' && !!currentEventId,
  })

  // When new slots are fetched, set them as the monthly availability
  useEffect(() => {
    if (isSlotsFetched) {
      setMonthlyAvailability(availableSlots)
    }
  }, [isSlotsFetched, availableSlots])

  const slotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return []
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return monthlyAvailability[dateKey] ?? []
  }, [monthlyAvailability, selectedDate])

  // Create booking mutation (unified for both free and paid)
  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTimeSlot || !selectedEventType || !selectedDate) {
        throw new Error('Missing required booking data')
      }

      // Combine selected date and time into ISO string
      const [hours, minutes] = selectedTimeSlot.split(':')
      const startTime = new Date(selectedDate)
      startTime.setHours(parseInt(hours ?? '0'), parseInt(minutes ?? '0'), 0, 0)

      const bookingPayload: BookingFormInput = {
        eventTypeId: selectedEventType.id,
        startTimeIso: startTime.toISOString(),
        attendeeName: formData.name,
        attendeeEmail: formData.email,
        mentorUsername: calcomUsername,
        mentorUserId: bookingData.userId,
        price: selectedEventType.price ?? 0, // price in cents
        currency: selectedEventType.currency ?? 'USD',
        timeZone: timeZone,
      }
      const response = await createStripePaymentIntent(bookingPayload)

      if (response.success && response.clientSecret) {
        setCurrentStep('payment')

        setClientSecret(response.clientSecret)
        setPaymentIntentId(response.paymentIntentId ?? null)
      } else {
        throw new Error(response.error ?? 'Failed to create booking')
      }
    },
  })

  const onPaymentConfirmed = () => {
    toast.success('Payment successful! Your booking will be confirmed via email shortly.')

    // Reset form
    setCurrentStep('calendar')
    setSelectedEventType(null)
    setSelectedTimeSlot(null)
    setFormData({ name: '', email: '' })
  }

  const handlePaymentError = (error: string) => {
    toast.error(error)
  }

  if (error) {
    throw new ExternalApiError(error.message)
  }

  if (eventTypesLoading) {
    return <BookingEmbedSkeleton />
  }

  if (eventTypesError) {
    return (
      <div className="flex min-h-[600px] items-center justify-center">
        <div className="text-center">
          <CalendarIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">Booking Unavailable</h3>
          <p className="text-muted-foreground">
            Failed to load booking calendar. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background h-full min-h-[600px] w-full">
      {currentStep === 'calendar' ? (
        <div className="p-6">
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-semibold">Schedule a Session</h2>
            <p className="text-muted-foreground text-sm">
              Choose your session type, then select a date and time
            </p>
          </div>

          {/* Event Type Selection */}
          <div className="mb-6">
            <Label className="mb-2 block text-sm font-medium">Session Type</Label>
            <Select
              value={selectedEventType?.id.toString() ?? ''}
              onValueChange={value => {
                const eventType = eventTypes.find(et => et.id.toString() === value)
                setSelectedEventType(eventType ?? null)
                setSelectedTimeSlot(null) // Reset time slot when changing event type
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a session type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map(eventType => (
                  <SelectItem key={eventType.id} value={eventType.id.toString()}>
                    <div className="flex w-full items-center justify-between">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{eventType.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {eventType.length} minutes
                        </span>
                      </div>
                      {eventType.price && eventType.price > 0 ? (
                        <Badge variant="secondary">
                          ${(eventType.price / 100).toFixed(2)} {eventType.currency}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Free</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEventType && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Calendar */}
              <div className="">
                <Label className="mb-2 block text-sm font-medium">Select Date</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={date => {
                    if (date) {
                      setSelectedDate(date)
                      setSelectedTimeSlot(null) // Reset time slot when changing date
                    }
                  }}
                  onMonthChange={month => {
                    setCurrentMonth(month)
                    setSelectedDate(undefined)
                    setSelectedTimeSlot(null)
                  }}
                  disabled={date => {
                    const dateKey = format(date, 'yyyy-MM-dd')
                    return date < today || !monthlyAvailability[dateKey]?.length
                  }}
                  className="rounded-md border"
                  startMonth={startMonth}
                  endMonth={endMonth}
                />
              </div>

              {/* Time Slots */}
              <div>
                <Label className="mb-2 block text-sm font-medium">Available Times</Label>
                {isFetching ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : slotsForSelectedDate.length > 0 ? (
                  <div className="grid gap-2">
                    {slotsForSelectedDate.map((slot, index) => (
                      <Button
                        key={index}
                        variant={selectedTimeSlot === slot.time ? 'default' : 'outline'}
                        className="justify-start"
                        disabled={!slot.available}
                        onClick={() => setSelectedTimeSlot(slot.time)}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        {slot.time}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center">
                    <CalendarIcon className="mx-auto mb-2 h-8 w-8" />
                    <p className="text-sm">Please select an available date</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Continue Button */}
          {selectedEventType && selectedTimeSlot && (
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setCurrentStep('booking')}>Continue</Button>
            </div>
          )}
        </div>
      ) : currentStep === 'booking' ? (
        <div className="p-6">
          <div className="mb-6">
            <h2 className="mb-2 text-xl font-semibold">Your Details</h2>
            <p className="text-muted-foreground text-sm">
              Please provide your contact information for the booking
            </p>
          </div>

          <div className="max-w-md space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your full name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your.email@example.com"
              />
            </div>

            {/* Booking Summary */}
            {selectedEventType && selectedTimeSlot && (
              <Card className="mt-4">
                <CardContent className="pt-4">
                  <h3 className="mb-2 font-medium">Booking Summary</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Session:</span>
                      <span>{selectedEventType.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{selectedDate?.toDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time:</span>
                      <span>{selectedTimeSlot}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span>{selectedEventType.length} minutes</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-medium">
                      <span>Price:</span>
                      <span>
                        {selectedEventType.price && selectedEventType.price > 0
                          ? `$${(selectedEventType.price / 100).toFixed(2)} ${selectedEventType.currency}`
                          : 'Free'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('calendar')}>
                Back
              </Button>
              <Button
                onClick={() => createBookingMutation.mutate()}
                disabled={!formData.name || !formData.email || createBookingMutation.isPending}
                className="flex-1"
              >
                {createBookingMutation.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating...
                  </>
                ) : selectedEventType?.price && selectedEventType.price > 0 ? (
                  'Continue to Payment'
                ) : (
                  'Confirm Booking'
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Payment step using Stripe Elements
        clientSecret &&
        selectedEventType &&
        selectedDate && (
          <div className="p-6">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#0f172a',
                    colorBackground: '#ffffff',
                    colorText: '#0f172a',
                    colorDanger: '#dc2626',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <PaymentForm
                eventType={selectedEventType}
                selectedDate={selectedDate}
                selectedTimeSlot={selectedTimeSlot ?? ''}
                formData={formData}
                paymentIntentId={paymentIntentId ?? undefined}
                onBack={() => setCurrentStep('booking')}
                onPaymentConfirmed={onPaymentConfirmed}
                onPaymentError={handlePaymentError}
              />
            </Elements>
          </div>
        )
      )}
    </div>
  )
}

// Internal PaymentForm component for handling Stripe payments
interface PaymentFormProps {
  eventType: EventType
  selectedDate: Date
  selectedTimeSlot: string
  formData: BookingFormData
  paymentIntentId?: string
  onBack: () => void
  onPaymentConfirmed: () => void
  onPaymentError: (error: string) => void
}

const PaymentForm = ({
  eventType,
  selectedDate,
  selectedTimeSlot,
  formData,
  paymentIntentId,
  onBack,
  onPaymentConfirmed,
  onPaymentError,
}: PaymentFormProps) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [taxAmount, setTaxAmount] = useState<number>(0)
  const [totalAmount, setTotalAmount] = useState<number | null>(null)
  const [lastTaxCalculation, setLastTaxCalculation] = useState<{
    postal_code: string
    state: string
    country: string
  } | null>(null)
  const [isCalculatingTax, setIsCalculatingTax] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          payment_method_data: {
            billing_details: {
              email: formData.email,
            },
          },
        },
        redirect: 'if_required',
      })

      if (result.error) {
        setMessage(result.error.message ?? 'An error occurred during payment')
        onPaymentError(result.error.message ?? 'An error occurred during payment')
      } else if (result.paymentIntent.status === 'succeeded') {
        // Payment successful, notify parent to update UI
        onPaymentConfirmed()
      } else {
        onPaymentError('Payment was not completed successfully')
      }
    } catch (error) {
      console.error('Payment confirmation error:', error)
      const errorMessage = 'An unexpected error occurred. Please try again.'
      setMessage(errorMessage)
      onPaymentError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const amount = eventType.price ?? 0
  const platformFee = Math.round(amount * 0.05) // 5% platform fee
  const subtotal = amount + platformFee
  // Note: Tax is calculated on the server and included in the payment intent amount
  // For display purposes, we'll show a note that tax may apply
  const formattedAmount = ((totalAmount ?? subtotal) / 100).toFixed(2)

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Complete Your Payment
          </CardTitle>
        </div>

        {/* Session Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{eventType.title}</h3>
              <p className="text-muted-foreground text-sm">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')} at {selectedTimeSlot}
              </p>
              <p className="text-muted-foreground text-sm">with {formData.name}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">${formattedAmount}</p>
              <div className="text-muted-foreground space-y-1 text-xs">
                <p>Base: ${(amount / 100).toFixed(2)}</p>
                <p>Platform fee: ${(platformFee / 100).toFixed(2)}</p>
                {isCalculatingTax && <p>Calculating tax...</p>}
                {taxAmount > 0 && <p>Estimated tax: ${(taxAmount / 100).toFixed(2)}</p>}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <PaymentElement />
            <AddressElement
              options={{ mode: 'billing', defaultValues: { name: formData.name } }}
              onChange={async ev => {
                if (!ev.complete || !paymentIntentId) return

                const address = ev.value.address
                const taxRelevantFields = {
                  postal_code: address.postal_code || '',
                  state: address.state || '',
                  country: address.country || '',
                }

                // Only calculate tax if tax-relevant fields have changed
                if (
                  lastTaxCalculation &&
                  lastTaxCalculation.postal_code === taxRelevantFields.postal_code &&
                  lastTaxCalculation.state === taxRelevantFields.state &&
                  lastTaxCalculation.country === taxRelevantFields.country
                ) {
                  return // No change in tax-relevant fields, skip calculation
                }

                // Require at least postal code and country for tax calculation
                if (!taxRelevantFields.postal_code || !taxRelevantFields.country) {
                  return
                }

                try {
                  setLastTaxCalculation(taxRelevantFields)
                  setIsCalculatingTax(true)
                  const amount = subtotal
                  const currency = eventType.currency ?? 'USD'

                  const tax = await calculateTax({
                    amount,
                    currency,
                    address: {
                      line1: address.line1,
                      line2: address.line2 ?? undefined,
                      city: address.city,
                      state: address.state,
                      postal_code: address.postal_code,
                      country: address.country,
                    },
                    customerEmail: formData.email,
                  })

                  if (tax.success && tax.totalAmount != null && tax.calculationId) {
                    setTaxAmount(tax.taxAmount ?? 0)
                    setTotalAmount(tax.totalAmount)
                    await updatePaymentIntentAmount({
                      calculationId: tax.calculationId,
                      paymentIntentId,
                      amount: tax.totalAmount,
                      taxAmount: tax.taxAmount ?? 0,
                      subtotal: amount,
                    })
                  }
                } catch (error) {
                  console.error('Error updating payment intent amount', error)
                } finally {
                  setIsCalculatingTax(false)
                }
              }}
            />
          </div>

          {message && (
            <div className="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
              {message}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!stripe || !elements || isLoading || isCalculatingTax}
          >
            {isLoading ? 'Processing...' : `Pay $${formattedAmount}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

const BookingEmbedSkeleton = () => {
  return (
    <div className="min-h-[600px] w-full p-6">
      <div className="mb-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
    </div>
  )
}
