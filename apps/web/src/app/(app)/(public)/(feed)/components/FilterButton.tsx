'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

import { useRouter } from 'next/navigation'
import { Button } from '~/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'

interface FilterValue {
  value: string
  label: string
  id: number
}

interface FilterProps {
  filterItems: FilterValue[]
  queryName: string
  startValue: string
}

export const FilterButton = ({ filterItems, queryName, startValue }: FilterProps) => {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(
    filterItems.find(item => item.label === startValue)?.value ?? ''
  )
  const router = useRouter()

  const handleFilterChange = (itemId: number) => {
    const selectedItem = filterItems.find(item => item.id === itemId)
    const selectedValue = selectedItem?.value ?? ''
    const url = new URL(window.location.href)

    if (selectedValue === value) {
      url.searchParams.delete(queryName)
      setValue('')
    } else {
      setValue(selectedValue)
      url.searchParams.set(queryName, selectedItem?.label ?? '')
    }

    router.push(url.toString())
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="focus:ring-primary w-[225px] justify-between focus:ring-2 dark:bg-gray-700 dark:text-gray-200"
        >
          {value ? filterItems.find(item => item.value === value)?.label : `Select ${queryName}...`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="border/40 bg-background/60 w-[225px] p-0 backdrop-blur-md">
        <Command>
          <CommandInput placeholder={`Search ${queryName}...`} className="bg-transparent" />
          <CommandList>
            <CommandEmpty>No {queryName} found.</CommandEmpty>
            <CommandGroup>
              {filterItems.map(item => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={() => {
                    handleFilterChange(item.id)
                  }}
                  className="text-foreground hover:bg-muted"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === item.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
