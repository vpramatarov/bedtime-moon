/**
 * Bundled offline town list (PRD-0001 §9, TKT-0005 AC #4 location control).
 * The Parent settings screen must offer a location choice without a network request, so the
 * app ships a fixed list instead of geocoding. PRD §9 leaves the exact list open ("50 largest
 * Bulgarian towns … is an open question"); this is 40 major towns with approximate
 * (city-centre) coordinates from general geography knowledge — accurate enough for TKT-0003's
 * 8-point compass direction word, not survey-grade. Revisit if finer precision is ever needed.
 */

export interface Town {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const TOWNS: readonly Town[] = [
  { id: 'sofia', name: 'София', lat: 42.7, lon: 23.32 },
  { id: 'plovdiv', name: 'Пловдив', lat: 42.14, lon: 24.75 },
  { id: 'varna', name: 'Варна', lat: 43.21, lon: 27.92 },
  { id: 'burgas', name: 'Бургас', lat: 42.5, lon: 27.47 },
  { id: 'ruse', name: 'Русе', lat: 43.85, lon: 25.96 },
  { id: 'stara-zagora', name: 'Стара Загора', lat: 42.43, lon: 25.63 },
  { id: 'pleven', name: 'Плевен', lat: 43.42, lon: 24.62 },
  { id: 'sliven', name: 'Сливен', lat: 42.68, lon: 26.32 },
  { id: 'dobrich', name: 'Добрич', lat: 43.57, lon: 27.83 },
  { id: 'shumen', name: 'Шумен', lat: 43.27, lon: 26.92 },
  { id: 'pernik', name: 'Перник', lat: 42.6, lon: 23.03 },
  { id: 'haskovo', name: 'Хасково', lat: 41.93, lon: 25.56 },
  { id: 'yambol', name: 'Ямбол', lat: 42.48, lon: 26.5 },
  { id: 'pazardzhik', name: 'Пазарджик', lat: 42.2, lon: 24.33 },
  { id: 'blagoevgrad', name: 'Благоевград', lat: 42.02, lon: 23.1 },
  { id: 'veliko-tarnovo', name: 'Велико Търново', lat: 43.08, lon: 25.63 },
  { id: 'vratsa', name: 'Враца', lat: 43.21, lon: 23.55 },
  { id: 'gabrovo', name: 'Габрово', lat: 42.87, lon: 25.32 },
  { id: 'vidin', name: 'Видин', lat: 43.99, lon: 22.88 },
  { id: 'kazanlak', name: 'Казанлък', lat: 42.62, lon: 25.4 },
  { id: 'asenovgrad', name: 'Асеновград', lat: 42.02, lon: 24.87 },
  { id: 'kyustendil', name: 'Кюстендил', lat: 42.28, lon: 22.69 },
  { id: 'kardzhali', name: 'Кърджали', lat: 41.65, lon: 25.38 },
  { id: 'montana', name: 'Монтана', lat: 43.41, lon: 23.23 },
  { id: 'dimitrovgrad', name: 'Димитровград', lat: 42.05, lon: 25.6 },
  { id: 'targovishte', name: 'Търговище', lat: 43.25, lon: 26.57 },
  { id: 'lovech', name: 'Ловеч', lat: 43.14, lon: 24.72 },
  { id: 'silistra', name: 'Силистра', lat: 44.11, lon: 27.26 },
  { id: 'dupnitsa', name: 'Дупница', lat: 42.27, lon: 23.12 },
  { id: 'razgrad', name: 'Разград', lat: 43.53, lon: 26.53 },
  { id: 'gorna-oryahovitsa', name: 'Горна Оряховица', lat: 43.13, lon: 25.7 },
  { id: 'smolyan', name: 'Смолян', lat: 41.58, lon: 24.7 },
  { id: 'petrich', name: 'Петрич', lat: 41.4, lon: 23.2 },
  { id: 'sandanski', name: 'Сандански', lat: 41.57, lon: 23.28 },
  { id: 'samokov', name: 'Самоков', lat: 42.34, lon: 23.55 },
  { id: 'sevlievo', name: 'Севлиево', lat: 43.03, lon: 25.11 },
  { id: 'lom', name: 'Лом', lat: 43.82, lon: 23.24 },
  { id: 'karlovo', name: 'Карлово', lat: 42.64, lon: 24.8 },
  { id: 'nova-zagora', name: 'Нова Загора', lat: 42.49, lon: 26.02 },
  { id: 'svishtov', name: 'Свищов', lat: 43.62, lon: 25.35 },
];
