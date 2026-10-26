/**
 * Format patient's 10-digit mobile number into unique Patient ID (PID)
 * @param {string} mobile 
 * @returns {string} PID-XXXXXXXXXX
 */
export const formatPatientId = (mobile) => {
  if (!mobile) return '';
  const digits = String(mobile).replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, '0');
  return `PID-${last10}`;
};

/**
 * Get dynamic greeting based on current local time
 * @param {string} name 
 * @returns {string}
 */
export const getGreeting = (name) => {
  const hour = new Date().getHours();
  let timeGreeting = 'Good day';
  if (hour >= 4 && hour < 12) {
    timeGreeting = 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    timeGreeting = 'Good Afternoon';
  } else {
    timeGreeting = 'Good Evening';
  }
  return `${timeGreeting}${name ? `, ${name}` : ''}`;
};

export const APP_TIMEZONE = 'Asia/Kolkata';

/**
 * Extract YYYY-MM-DD calendar date string in application timezone (Asia/Kolkata).
 * Avoids UTC shifts (e.g. 18:30 UTC turning into previous date).
 * @param {string|Date|number} dateInput
 * @returns {string} YYYY-MM-DD
 */
export const toCalendarDateString = (dateInput) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

/**
 * Compare two dates by their calendar dates (YYYY-MM-DD).
 * @returns {number} -1 if dateA < dateB, 0 if equal, 1 if dateA > dateB
 */
export const compareCalendarDates = (dateA, dateB = new Date()) => {
  const strA = toCalendarDateString(dateA);
  const strB = toCalendarDateString(dateB);
  if (!strA || !strB) return 0;
  if (strA < strB) return -1;
  if (strA > strB) return 1;
  return 0;
};

/**
 * Checks if a follow-up appointment date is strictly in the future compared to reference date (today).
 * @param {string|Date} dateInput
 * @param {string|Date} referenceDate Default is current time
 * @returns {boolean}
 */
export const isFollowUpDateInFuture = (dateInput, referenceDate = new Date()) => {
  const targetStr = toCalendarDateString(dateInput);
  const refStr = toCalendarDateString(referenceDate);
  return Boolean(targetStr && refStr && targetStr > refStr);
};

/**
 * Checks if a follow-up appointment date is today's calendar date.
 * @param {string|Date} dateInput
 * @param {string|Date} referenceDate Default is current time
 * @returns {boolean}
 */
export const isFollowUpDateToday = (dateInput, referenceDate = new Date()) => {
  const targetStr = toCalendarDateString(dateInput);
  const refStr = toCalendarDateString(referenceDate);
  return Boolean(targetStr && refStr && targetStr === refStr);
};

/**
 * Checks if a follow-up appointment date has passed (overdue).
 * @param {string|Date} dateInput
 * @param {string|Date} referenceDate Default is current time
 * @returns {boolean}
 */
export const isFollowUpDateOverdue = (dateInput, referenceDate = new Date()) => {
  const targetStr = toCalendarDateString(dateInput);
  const refStr = toCalendarDateString(referenceDate);
  return Boolean(targetStr && refStr && targetStr < refStr);
};

/**
 * Format ISO date string into readable date (e.g. 15 May 1995)
 * @param {string} dateStr 
 * @returns {string}
 */
export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Format body temperature for display.
 * Displays Fahrenheit (°F) values clearly, and preserves/accurately converts
 * historical records stored in Celsius (°C).
 * @param {number|string} temp
 * @param {string} unit
 * @returns {string}
 */
export const formatDisplayTemperature = (temp, unit = '°F') => {
  if (temp === undefined || temp === null || temp === '') return '';
  const num = Number(temp);
  if (isNaN(num)) return `${temp} ${unit}`;
  if (unit === '°C' || unit === 'C') {
    const inF = ((num * 9) / 5 + 32).toFixed(1);
    return `${inF} °F (${num} °C)`;
  }
  return `${num} °F`;
};
