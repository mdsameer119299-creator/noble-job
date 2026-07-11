'use client'

import { useRef, useState, useId } from 'react'
import { validateResumeFile } from '@/lib/utils/resumeUpload'

/**
 * Reusable resume file-selection primitive for the Resume AI workspace (Improve
 * and Tailor entry flows). Reuses the production `validateResumeFile` rules
 * (PDF/DOC/DOCX, ≤5 MB, ext + MIME). Handles select / replace / remove, shows
 * the selected filename + a truthful "ready" status, and surfaces validation
 * errors accessibly.
 *
 * IMPORTANT: nothing is uploaded, parsed or persisted here. Selection stays in
 * the browser; the parent flow decides what (if anything) to do with the file.
 * This keeps anonymous files private and avoids claiming any AI work occurred.
 */

interface Props {
  /** Called with a validated File (never on invalid input). */
  onFileReady?: (file: File, ext: string) => void
  /** Called when the user removes the current file. */
  onClear?: () => void
  /** Prompt shown in the empty dropzone. */
  prompt?: string
}

export function ResumeFilePicker({ onFileReady, onClear, prompt }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const errorId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  function handle(f: File) {
    const v = validateResumeFile(f)
    if (!v.ok) {
      setError(v.error)
      setFile(null)
      onClear?.()
      return
    }
    setError('')
    setFile(f)
    onFileReady?.(f, v.ext)
  }
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handle(f)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handle(f)
  }
  function openPicker() {
    inputRef.current?.click()
  }
  function remove() {
    setFile(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
    onClear?.()
  }

  function fmtSize(bytes: number) {
    const kb = bytes / 1024
    return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={onPick}
        style={{ display: 'none' }}
        aria-hidden
        tabIndex={-1}
      />

      {!file ? (
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={openPicker}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() } }}
          role="button"
          tabIndex={0}
          aria-label="Add your resume — PDF, DOC or DOCX, up to 5 MB"
          aria-describedby={error ? errorId : undefined}
          style={{
            border: '2px dashed #cbd5e1', borderRadius: 12, padding: '26px 18px',
            textAlign: 'center', cursor: 'pointer', background: '#f8faff',
          }}
        >
          <div style={{ fontSize: 30, marginBottom: 6 }} aria-hidden>📄</div>
          <div style={{ fontWeight: 800, color: '#0d1f4e', fontSize: 15 }}>Add your resume</div>
          <div style={{ color: '#6b7280', fontSize: 12.5, marginTop: 4 }}>
            {prompt || 'PDF, DOC or DOCX · up to 5 MB · nothing is saved'}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #bbf7d0',
            background: '#f0fdf4', borderRadius: 12, padding: '14px 16px',
          }}
        >
          <div style={{ fontSize: 22 }} aria-hidden>✅</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: '#065f46', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ color: '#059669', fontSize: 11.5 }}>Ready · {fmtSize(file.size)} · not uploaded yet</div>
          </div>
          <button
            type="button"
            onClick={openPicker}
            style={pickerBtn}
            aria-label={`Replace ${file.name}`}
          >
            Replace
          </button>
          <button
            type="button"
            onClick={remove}
            style={{ ...pickerBtn, color: '#be123c', borderColor: '#fecaca' }}
            aria-label={`Remove ${file.name}`}
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <div id={errorId} role="alert" style={{ color: '#be123c', fontSize: 12.8, marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  )
}

const pickerBtn = {
  flexShrink: 0, background: '#fff', border: '1.5px solid #d1d5db', borderRadius: 8,
  padding: '6px 11px', fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer',
} as const
