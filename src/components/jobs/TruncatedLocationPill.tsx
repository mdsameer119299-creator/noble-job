'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * TruncatedLocationPill — fixes the "enormous list of countries inside a single
 * job card" layout bug.
 *
 * Root cause: Himalayas-sourced live jobs (src/lib/services/himalayasService.ts)
 * set `location` to `locationRestrictions.join(" / ")`, which for a worldwide- or
 * multi-region-eligible remote role can be a long, unbounded list of countries
 * (e.g. "United States / Canada / United Kingdom / Germany / France / ..."). The
 * job cards (JobCard, AbroadJobCard) rendered that whole string as one pill with
 * no width limit, so the card grew to fit it and distorted the layout.
 *
 * This component never drops or rewrites the underlying data — every location in
 * the list is still present and reachable — it only limits how much is shown
 * AT ONCE, with a click to reveal the rest. A short, ordinary value (a single
 * city or "Remote") renders exactly as it always did, just inside a pill with a
 * sane max width so a single long value can't blow out the card either.
 */

const SPLIT_RE = /\s*\/\s*|\s*,\s*/

/**
 * Split a delimited location value ("A / B / C" or "A, B, C") into its parts.
 * Only treated as a list when splitting actually yields more than one part —
 * a single real place name like "Bengaluru, Karnataka" still has a comma, but
 * callers pass whole fields, not a reason to special-case here: both halves are
 * still genuine location text either way, so showing them as "2 locations" is
 * harmless, and the common case (no delimiter at all) returns the value as-is.
 */
export function splitLocationList(value: string): string[] {
  if (!value) return []
  const parts = value.split(SPLIT_RE).map(p => p.trim()).filter(Boolean)
  return parts.length > 1 ? parts : [value]
}

interface TruncatedLocationPillProps {
  icon: string
  value: string
  maxItems?: number
  maxChars?: number
  background?: string
  color?: string
}

export function TruncatedLocationPill({
  icon,
  value,
  maxItems = 2,
  maxChars = 42,
  background = '#f0f4ff',
  color = '#374151',
}: TruncatedLocationPillProps) {
  const [expanded, setExpanded] = useState(false)
  const parts = splitLocationList(value)
  const isLongList = parts.length > maxItems
  const isLongString = !isLongList && value.length > maxChars

  const pillStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background,
    color,
    padding: '5px 11px',
    borderRadius: 20,
    fontSize: 12.5,
    fontWeight: 600,
    border: 'none',
    font: 'inherit',
    fontFamily: 'inherit',
    maxWidth: 280,
  }

  if (!isLongList && !isLongString) {
    return <span style={pillStyle}>{icon} {value}</span>
  }

  if (expanded) {
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setExpanded(false) }}
        style={{ ...pillStyle, cursor: 'pointer', maxWidth: 360, whiteSpace: 'normal', textAlign: 'left' }}
        title="Click to collapse"
      >
        {icon} {isLongList ? parts.join(' · ') : value} <span style={{ opacity: 0.6 }}>▲</span>
      </button>
    )
  }

  const preview = isLongList
    ? parts.slice(0, maxItems).join(', ')
    : `${value.slice(0, maxChars).trimEnd()}…`
  const moreCount = isLongList ? parts.length - maxItems : undefined

  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); setExpanded(true) }}
      style={{
        ...pillStyle,
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={`Click to see ${isLongList ? `all ${parts.length} locations` : 'full text'}`}
    >
      {icon} {preview}{moreCount ? ` +${moreCount} more` : ''}
    </button>
  )
}
