import type { CountryProfile } from './countryProfile'

// Multilingual city/region variants. For Belgium, `namen` (NL "names") and
// `bergen` (NL "mountains", Norway) are deliberately excluded as
// false-positive sources.
const BE: CountryProfile = {
  code: 'BE',
  name: 'Belgium',
  adjective: 'Belgian',
  flag: '🇧🇪',
  tlds: ['be'],
  rules: [
    { name: 'country', weight: 3, words: ['belgium', 'belgique', 'belgië', 'belgie', 'belgien'] },
    {
      name: 'institution',
      weight: 2,
      words: ['ulb', 'vub', 'uclouvain', 'ku ?leuven', 'ugent', 'uliège', 'uliege', 'ulg', 'vrt', 'rtbf', 'imec', 'kbr'],
    },
    { name: 'nationality', weight: 1, words: ['belgian', 'belge', 'belg', 'belgisch', 'belgische'] },
    {
      name: 'football',
      weight: 1,
      words: [
        'anderlecht',
        'club brugge',
        'standard (?:de )?liège',
        'rsca',
        'kaa gent',
        'krc genk',
        'union saint-gilloise',
        'rusg',
      ],
    },
  ],
  places: {
    Brussels: ['brussel', 'brussels', 'bruxelles', 'bxl'],
    Antwerp: ['antwerpen', 'antwerp', 'anvers'],
    Ghent: ['ghent', 'gent', 'gand'],
    Liège: ['liège', 'liege', 'luik'],
    Charleroi: ['charleroi'],
    Bruges: ['brugge', 'bruges'],
    Leuven: ['leuven', 'louvain(?:-la-neuve)?'],
    Namur: ['namur'],
    Mons: ['mons'],
    Hasselt: ['hasselt'],
    Mechelen: ['mechelen', 'malines'],
    Kortrijk: ['kortrijk', 'courtrai'],
    Ostend: ['oostende', 'ostend'],
    Tournai: ['tournai', 'doornik'],
    Wallonia: ['wallonia', 'wallonie', 'wallonië'],
    Flanders: ['flanders', 'vlaanderen', 'flandre'],
  },
}

// First draft: these word lists should be reviewed by an Italian verifier.
const IT: CountryProfile = {
  code: 'IT',
  name: 'Italy',
  adjective: 'Italian',
  flag: '🇮🇹',
  tlds: ['it'],
  rules: [
    { name: 'country', weight: 3, words: ['italia', 'italy', 'italie', 'italien'] },
    {
      name: 'institution',
      weight: 2,
      words: ['polimi', 'sapienza', 'unibo', 'bocconi', 'unimi', 'cnr', 'infn', 'rai'],
    },
    { name: 'nationality', weight: 1, words: ['italiano', 'italiana', 'italiani', 'italiane', 'italian'] },
    { name: 'football', weight: 1, words: ['juventus', 'juve', 'forza inter', 'forza napoli', 'as roma'] },
  ],
  places: {
    Rome: ['roma', 'rome'],
    Milan: ['milano', 'milan'],
    Naples: ['napoli', 'naples'],
    Turin: ['torino', 'turin'],
    Florence: ['firenze', 'florence'],
    Bologna: ['bologna'],
    Venice: ['venezia', 'venice'],
    Genoa: ['genova', 'genoa'],
    Palermo: ['palermo'],
    Bari: ['bari'],
    Sicily: ['sicilia', 'sicily'],
    Sardinia: ['sardegna', 'sardinia'],
    Tuscany: ['toscana', 'tuscany'],
  },
}

export const PROFILES: Record<string, CountryProfile> = { BE, IT }

export function profileFor(code: string | null | undefined): CountryProfile | null {
  if (!code) return null
  return PROFILES[code.toUpperCase()] ?? null
}
