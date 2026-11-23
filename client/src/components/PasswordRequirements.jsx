import React from 'react'

export default function PasswordRequirements({ password = '', minLength = 8 }) {
  const rules = [
    [password.length >= minLength && password.length <= 128, `Từ ${minLength} đến 128 ký tự`],
    [/[A-Z]/.test(password), 'Ít nhất 1 chữ hoa'],
    [/[a-z]/.test(password), 'Ít nhất 1 chữ thường'],
    [/[0-9]/.test(password), 'Ít nhất 1 chữ số'],
    [/[^A-Za-z0-9]/.test(password), 'Ít nhất 1 ký tự đặc biệt']
  ]

  return (
    <div style={{ fontSize: 12, lineHeight: 1.7, margin: '4px 0 10px' }}>
      {rules.map(([ok, label]) => (
        <div key={label} style={{ color: ok ? '#86efac' : '#e2e8f0' }}>
          {ok ? '✓' : '○'} {label}
        </div>
      ))}
    </div>
  )
}
