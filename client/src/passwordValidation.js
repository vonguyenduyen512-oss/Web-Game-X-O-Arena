export function validatePassword(password, minLength = 8) {
  if (typeof password !== 'string' || password.length < minLength || password.length > 128)
    return `Mật khẩu phải có từ ${minLength} đến 128 ký tự.`
  if (!/[A-Z]/.test(password))
    return 'Mật khẩu phải có ít nhất 1 chữ hoa.'
  if (!/[a-z]/.test(password))
    return 'Mật khẩu phải có ít nhất 1 chữ thường.'
  if (!/[0-9]/.test(password))
    return 'Mật khẩu phải có ít nhất 1 chữ số.'
  if (!/[^A-Za-z0-9]/.test(password))
    return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt.'
  return ''
}
