import { useUser } from '../context/UserContext'
import aiAvatar from '../assets/23codex.jpg'

function Message({ message }) {
  const { user } = useUser()
  const isUser = message.role === 'user'

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden">
          <img src={aiAvatar} alt="AI" className="w-full h-full object-cover" />
        </div>
      )}

      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-gray-900 dark:bg-bg-000 text-white dark:text-text-000'
          : 'bg-gray-100 dark:bg-bg-100 text-gray-800 dark:text-text-200'
      }`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 dark:bg-bg-200 flex items-center justify-center overflow-hidden">
          {user.photo ? (
            <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white dark:text-white text-sm font-semibold">{getInitials(user.name)}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default Message
