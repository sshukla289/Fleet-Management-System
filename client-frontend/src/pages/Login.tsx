import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/useAuth'

export function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login({ email, password })
      navigate('/', { replace: true })
    } catch {
      setError('Invalid credentials. Please verify your email and password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__copy">
          <img src="/logo.svg" alt="Express Logistics Logo" className="login-logo" style={{ display: 'block', width: '260px' }} />

        </div>
        <form className="login-card__form" onSubmit={handleSubmit}>
          <div>
            <h2>Welcome back</h2>
            <p>Log in to monitor and manage your fleet</p>
          </div>
          <label className="input-group">
            <span>Email</span>
            <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          </label>
          <label className="input-group">
            <span>Password</span>
            <input
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button login-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
