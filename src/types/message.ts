export interface Message {
  id: string; sender_id: string; recipient_id: string
  application_id?: string; content: string; sent_at: string; is_read: boolean
  sender?: { email: string }
}
export interface MessageThread {
  otherUserId: string; otherUserName: string; lastMessage: string
  lastSentAt: string; unreadCount: number
}
