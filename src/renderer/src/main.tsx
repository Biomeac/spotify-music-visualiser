import { createRoot } from 'react-dom/client'
import App from './App'
import Overlay from './components/Overlay'
import './styles.css'

const isOverlay = location.hash === '#overlay'
document.documentElement.classList.toggle('is-overlay', isOverlay)
createRoot(document.getElementById('root')!).render(isOverlay ? <Overlay /> : <App />)
