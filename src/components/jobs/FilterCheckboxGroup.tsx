'use client'
interface FilterCheckboxGroupProps {
  title: string
  items: { label: string; value: string }[]
  selected: string[]
  onChange: (values: string[]) => void
}

export function FilterCheckboxGroup({ title, items, selected, onChange }: FilterCheckboxGroupProps) {
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter(x => x !== v))
    else onChange([...selected, v])
  }
  return (
    <div style={{ marginBottom: 20 }}>
      <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0d1f4e', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>{title}</h4>
      {items.map(item => (
        <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer' }}>
          <input type="checkbox" checked={selected.includes(item.value)} onChange={() => toggle(item.value)} style={{ accentColor: '#1847d4' }} />
          <span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span>
        </label>
      ))}
    </div>
  )
}
