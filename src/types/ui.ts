export type ToastType = 'success' | 'error' | 'info' | 'warning'
export interface Toast { id: string; message: string; type: ToastType }
export interface ModalProps { open: boolean; onClose: () => void }
export type SortOrder = 'latest' | 'salary_high' | 'applicants' | 'oldest'
