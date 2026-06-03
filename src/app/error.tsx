'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-2xl font-bold text-noble-navy mb-4">Something went wrong</h2>
      <p className="text-t3 mb-6">{error.message}</p>
      <button onClick={reset} className="btn-primary px-6 py-3 rounded-btn text-white font-bold"
        style={{background:'#1847d4'}}>Try again</button>
    </div>
  )
}
