import { useMemo } from 'react'
import { useUser } from '../context/UserContext'
import ChatInput from './ChatInput'

const SUGGESTIONS = [
  { icon: 'pencil', label: 'Escrever' },
  { icon: 'graduation', label: 'Aprender' },
  { icon: 'code', label: 'Código' },
  { icon: 'heart', label: 'Assuntos pessoais' },
  { icon: 'sparkles', label: 'Escolha do 23 Code' },
]

const GREETINGS = {
  morning: [
    'Bom dia',
    'Bom dia, campeão',
    'Alô, madrugador',
    'Bom dia, guerreiro',
    'Dia bom pra codar',
  ],
  afternoon: [
    'Boa tarde',
    'Boa tarde, parceiro',
    'E aí, codador',
    'Boa tarde, dev',
    'Hora de produzir',
  ],
  evening: [
    'Boa noite',
    'Boa noite, noturno',
    'E aí, madrugador',
    'Boa noite, guerreiro',
    'Noite de produtividade',
  ],
  night: [
    'Boa madrugada',
    'Cês não dorme, né?',
    'Madrugada é o novo dia',
    'Acordei pra codar',
    'Noite é dia produtivo',
  ],
}

const SUBTITLES = {
  morning: [
    'O sol nasceu, o café tá pronto',
    'Hora de conquistar o dia',
    'Vamos começar com tudo',
    'Dia novo, bugs novos',
    'O compilador espera por você',
  ],
  afternoon: [
    'Já almoçou? Bora codar',
    'Metade do dia, metade do código',
    'Tarde produtiva te espera',
    'O deploy tá esperando',
    'Coffee break acabou',
  ],
  evening: [
    'O dia tá acabando, bora entregar',
    'Noite é hora de foco',
    'Vamos fechar esse PR',
    'O git tá pedindo um commit',
    'Últimas linhas do dia',
  ],
  night: [
    'Quem dorme não commita',
    'A noite é jovem, assim como o código',
    'Bug se resolve de madrugada',
    'O silêncio é bom pro código',
    'Noite de deploy especial',
  ],
}

function getTimeOfDay() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 23) return 'evening'
  return 'night'
}

function getDaySeed() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now - start
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor(diff / oneDay)
  return Math.floor(dayOfYear / 2)
}

function pickRandom(arr, seed) {
  const index = seed % arr.length
  return arr[index]
}

function SuggestionIcon({ name }) {
  const icons = {
    pencil: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
        <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z"/>
      </svg>
    ),
    graduation: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
        <path d="M251.76,88.94l-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V240a8,8,0,0,0,16,0V199.51a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12ZM128,200c-43.27,0-68.72-21.14-80-33.71V126.4l76.24,40.66a8,8,0,0,0,7.52,0L176,143.47v46.34C163.4,195.69,147.52,200,128,200Zm80-33.75a97.83,97.83,0,0,1-16,14.25V134.93l16-8.53ZM188,118.94l-.22-.13-56-29.87a8,8,0,0,0-7.52,14.12L171,128l-43,22.93L25,96,128,41.07,231,96Z"/>
      </svg>
    ),
    code: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
        <path d="M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.3Zm176,27.7-48-40a8,8,0,1,0-10.24,12.3L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z"/>
      </svg>
    ),
    heart: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
        <path d="M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56v8a40,40,0,0,1-37.51,39.91,96.59,96.59,0,0,1-27,40.09H208a8,8,0,0,1,0,16H32a8,8,0,0,1,0-16H56.54A96.3,96.3,0,0,1,24,136V88a8,8,0,0,1,8-8H208A40,40,0,0,1,248,120ZM200,96H40v40a80.27,80.27,0,0,0,45.12,72h69.76A80.27,80.27,0,0,0,200,136Zm32,24a24,24,0,0,0-16-22.62V136a95.78,95.78,0,0,1-1.2,15A24,24,0,0,0,232,128Z"/>
      </svg>
    ),
    sparkles: (
      <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
        <path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z"/>
      </svg>
    ),
  }
  return icons[name] || null
}

function WelcomeScreen({ onSendMessage, selectedModel, onModelChange }) {
  const { user } = useUser()

  const greeting = useMemo(() => {
    const timeOfDay = getTimeOfDay()
    const seed = getDaySeed()
    const greetings = GREETINGS[timeOfDay]
    const subtitles = SUBTITLES[timeOfDay]
    return {
      text: pickRandom(greetings, seed),
      subtitle: pickRandom(subtitles, seed + 1),
    }
  }, [])

  const firstName = user.name?.split(' ')[0] || ''

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-bg-100">
      <div className="min-h-0 flex-1 flex flex-col">
        <main className="mx-auto w-full flex-1 flex flex-col items-center px-4 md:px-8 lg:px-14 pt-[10vh] md:pt-[20vh] max-w-7xl">

          <div className="transition-opacity duration-300">
            <div className="mx-auto flex w-full flex-col items-center gap-7 max-w-2xl">

              <div className="w-full flex justify-center">
                <h1
                  className="text-center font-display text-gray-800 dark:text-text-000"
                  style={{ lineHeight: 1.5, fontSize: 'clamp(1.875rem, 1.2rem + 2vw, 2.5rem)' }}
                >
                  <span className="select-none">
                    {greeting.text}{firstName ? `, ${firstName}` : ''}
                  </span>
                </h1>
              </div>

              <p className="text-center text-gray-500 dark:text-text-200 text-sm -mt-4">
                {greeting.subtitle}
              </p>

            </div>
          </div>

          <div className="top-5 z-10 mx-auto w-full max-w-2xl mt-8">
            <ChatInput onSend={onSendMessage} placeholder="Como posso ajudar você hoje?" selectedModel={selectedModel} onModelChange={onModelChange} />

            <div className="relative mx-auto w-full mt-4">
              <ul className="flex flex-wrap justify-center w-full gap-2 pt-4">
                {SUGGESTIONS.map((s) => (
                  <li key={s.label} className="inline-block">
                    <button
                      type="button"
                      onClick={() => onSendMessage(s.label)}
                      className="group relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none border-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-text-200 bg-gray-100 dark:bg-bg-200 hover:bg-gray-200 dark:hover:bg-bg-200 transition-colors shadow-sm"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-gray-500 dark:text-text-300 -ml-0.5">
                          <SuggestionIcon name={s.icon} />
                        </span>
                        <span className="font-normal">{s.label}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}

export default WelcomeScreen
