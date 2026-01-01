export function isValidDate(date: string) {
  // expect YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function isValidTime(time: string) {
  // expect HH:MM (24h)
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function isValidEmail(email: string) {
  // very small sanity check
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
