<script lang="ts">
  import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    isToday,
    parseISO,
    startOfMonth,
    startOfWeek
  } from 'date-fns'
  import { fr } from 'date-fns/locale'
  import { todayISO } from '../lib/dates'
  import { urgencyOf } from '../lib/urgency'
  import type { ActionRow, EntityRow } from '../lib/types'

  interface Item {
    action: ActionRow
    entity: EntityRow
    muted: boolean
  }

  let {
    items,
    view,
    anchor = $bindable(todayISO())
  }: { items: Item[]; view: 'week' | '2weeks' | 'month'; anchor?: string } = $props()

  const weekStart = { weekStartsOn: 1 as const }
  const reference = $derived(parseISO(anchor))

  const days = $derived.by(() => {
    if (view === 'month') {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(reference), weekStart),
        end: endOfWeek(endOfMonth(reference), weekStart)
      })
    }
    const start = startOfWeek(reference, weekStart)
    return eachDayOfInterval({ start, end: addDays(start, view === 'week' ? 6 : 13) })
  })

  const rangeLabel = $derived.by(() => {
    if (view === 'month') return format(reference, 'MMMM yyyy', { locale: fr })
    const start = startOfWeek(reference, weekStart)
    const end = addDays(start, view === 'week' ? 6 : 13)
    return `${format(start, 'd MMM', { locale: fr })} – ${format(end, 'd MMM yyyy', { locale: fr })}`
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

  function shift(direction: 1 | -1) {
    if (view === 'month') {
      anchor = format(addMonths(reference, direction), 'yyyy-MM-dd')
      return
    }
    const step = view === 'week' ? 7 : 14
    anchor = format(addDays(reference, direction * step), 'yyyy-MM-dd')
  }

  function goToday() {
    anchor = todayISO()
  }
</script>

<div class="calendar-nav">
  <button
    type="button"
    class="btn btn-sm icon-btn"
    aria-label="Période précédente"
    title="Période précédente"
    onclick={() => shift(-1)}
  >‹</button>
  <strong class="calendar-range">{rangeLabel}</strong>
  <button
    type="button"
    class="btn btn-sm icon-btn"
    aria-label="Période suivante"
    title="Période suivante"
    onclick={() => shift(1)}
  >›</button>
  <button type="button" class="btn btn-sm btn-ghost calendar-today" onclick={goToday}>
    Aujourd’hui
  </button>
</div>

<div class="calendar-scroll">
  <div class="calendar-grid">
    {#each weekdays as day}
      <div class="calendar-weekday">{day}</div>
    {/each}
    {#each days as day (format(day, 'yyyy-MM-dd'))}
      <div
        class="calendar-day"
        class:outside={view === 'month' && !isSameMonth(day, reference)}
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
