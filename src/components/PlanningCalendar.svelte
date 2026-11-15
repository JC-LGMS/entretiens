<script lang="ts">
  import {
    addDays,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek
  } from 'date-fns'
  import { urgencyOf } from '../lib/urgency'
  import type { ActionRow, EntityRow } from '../lib/types'

  interface Item {
    action: ActionRow
    entity: EntityRow
    muted: boolean
  }

  let {
    items,
    view
  }: { items: Item[]; view: 'week' | '2weeks' | 'month' } = $props()

  const today = new Date()
  const weekStart = { weekStartsOn: 1 as const }

  const days = $derived.by(() => {
    if (view === 'month') {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(today), weekStart),
        end: endOfWeek(endOfMonth(today), weekStart)
      })
    }
    const start = startOfWeek(today, weekStart)
    return eachDayOfInterval({ start, end: addDays(start, view === 'week' ? 6 : 13) })
  })

  const byDay = $derived.by(() => {
    const map = new Map<string, Item[]>()
    for (const item of items) {
      const key = item.action.next_due
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.action.label.localeCompare(b.action.label, 'fr'))
    }
    return map
  })

  const weekdays = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
</script>

<div class="calendar-scroll">
  <div class="calendar-grid">
    {#each weekdays as day}
      <div class="calendar-weekday">{day}</div>
    {/each}
    {#each days as day (format(day, 'yyyy-MM-dd'))}
      <div
        class="calendar-day"
        class:outside={view === 'month' && !isSameMonth(day, today)}
        class:today={isToday(day)}
      >
        <div class="calendar-day-number">{format(day, 'd')}</div>
        <div class="calendar-events">
          {#each byDay.get(format(day, 'yyyy-MM-dd')) ?? [] as item (item.action.id)}
            <a
              class={`calendar-chip ${urgencyOf(item.action.next_due)}`}
              href={`#/entity/${item.entity.id}?action=${item.action.id}`}
              title={`${item.action.label} · ${item.entity.name}`}
            >
              {item.action.label}
            </a>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>
