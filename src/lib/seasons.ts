/**
 * Seasonal themes: which one a date gets. Local dates (YYYY-MM-DD).
 *
 *   Birthday   May 21 (Sophie's phone only; beats everything)
 *   Halloween  October
 *   Thanksgiving November
 *   Christmas  December 1-30
 *   NYE        December 31
 *   Easter     the two weeks before Easter Sunday through the week after
 *   Patriotic  Flag Day (June 14) through the 4th of July
 *   Winter     January 1 to the first day of spring (March 20)
 *   Spring     March 20 to June 13
 *   Summer     July 5 to the first day of fall (September 22)
 *   Fall       September 22-30
 */

export type Season =
  | 'fall'
  | 'halloween'
  | 'thanksgiving'
  | 'christmas'
  | 'nye'
  | 'winter'
  | 'spring'
  | 'easter'
  | 'patriotic'
  | 'summer'
  | 'birthday'

export const SEASONS: readonly Season[] = ['fall', 'halloween', 'thanksgiving', 'christmas', 'nye', 'winter', 'spring', 'easter', 'patriotic', 'summer', 'birthday']

export const SEASON_LABEL: Record<Season, string> = {
  fall: 'Fall',
  halloween: 'Halloween',
  thanksgiving: 'Thanksgiving',
  christmas: 'Christmas',
  nye: 'New Year’s Eve',
  winter: 'Winter',
  spring: 'Spring',
  easter: 'Easter',
  patriotic: 'Stars & stripes',
  summer: 'Summer',
  birthday: 'Birthday',
}

/** A line beside the date on Today. */
export const SEASON_TAGLINE: Record<Season, string> = {
  fall: 'Sweater weather',
  halloween: 'Spooky season',
  thanksgiving: 'Thankful for you',
  christmas: 'Merry & bright',
  nye: 'Last lifts of the year',
  winter: 'Stay cozy',
  spring: 'Fresh start',
  easter: 'He is risen! Alleluia',
  patriotic: 'Land of the free',
  summer: 'Sun’s out',
  birthday: 'Happy birthday, Sophie!',
}

const BIRTHDAY = '05-21'

/** Easter Sunday (Gregorian), by the anonymous Meeus/Jones/Butcher algorithm. */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function dayNum(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}

/**
 * The line beside the date on Today. Easter follows the liturgical calendar:
 * "Easter is coming", then "Holy Week" from Palm Sunday, then "He is risen!"
 * from Easter Sunday.
 */
export function seasonTagline(season: Season, date: string): string {
  if (season !== 'easter') return SEASON_TAGLINE[season]
  const fromEaster = dayNum(date) - dayNum(easterSunday(Number(date.slice(0, 4))))
  if (fromEaster < -7) return 'Easter is coming'
  if (fromEaster < 0) return 'Holy Week'
  return SEASON_TAGLINE.easter
}

/** The theme for a local date. `withBirthday`: Sophie's phone. */
export function seasonFor(date: string, withBirthday = false): Season {
  const md = date.slice(5)
  if (withBirthday && md === BIRTHDAY) return 'birthday'
  const month = Number(date.slice(5, 7))
  if (month === 10) return 'halloween'
  if (month === 11) return 'thanksgiving'
  if (month === 12) return md === '12-31' ? 'nye' : 'christmas'
  const fromEaster = dayNum(date) - dayNum(easterSunday(Number(date.slice(0, 4))))
  if (fromEaster >= -14 && fromEaster <= 7) return 'easter'
  if (md >= '06-14' && md <= '07-04') return 'patriotic'
  if (md < '03-20') return 'winter'
  if (md < '06-14') return 'spring'
  if (md < '09-22') return 'summer'
  return 'fall'
}
