import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import StudentWorkspace from './roles/student/StudentWorkspace.jsx'
import Instructor from './roles/instructor/Instructor.jsx'
import Admin from './roles/admin/Admin.jsx'

const role = window.location.pathname.split('/')[1]
const Workspace = role === 'admin' ? Admin : role === 'instructor' ? Instructor : StudentWorkspace

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Workspace />
  </StrictMode>,
)
