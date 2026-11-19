import type { CountryProfile, SignalProfile } from './countryProfile'
import { customProfile } from './customTerms'
import { genericCountryProfile } from './genericCountry'

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

// First draft: these word lists should be reviewed by a French verifier.
// "nice" is deliberately excluded (English word).
const FR: CountryProfile = {
  code: 'FR',
  name: 'France',
  adjective: 'French',
  flag: '🇫🇷',
  tlds: ['fr'],
  rules: [
    { name: 'country', weight: 3, words: ['france', 'frankrijk', 'frankreich', 'francia'] },
    {
      name: 'institution',
      weight: 2,
      words: [
        'cnrs',
        'inria',
        'inserm',
        'sorbonne',
        'sciences ?po',
        'polytechnique',
        'radio france',
        'france inter',
        'france tv',
        'afp',
      ],
    },
    { name: 'nationality', weight: 1, words: ['français', 'française', 'francais', 'francaise', 'french'] },
    {
      name: 'football',
      weight: 1,
      words: ['psg', 'paris saint-germain', 'olympique de marseille', 'olympique lyonnais'],
    },
  ],
  places: {
    Paris: ['paris'],
    Lyon: ['lyon'],
    Marseille: ['marseille', 'marseilles'],
    Toulouse: ['toulouse'],
    Nantes: ['nantes'],
    Strasbourg: ['strasbourg'],
    Montpellier: ['montpellier'],
    Bordeaux: ['bordeaux'],
    Lille: ['lille'],
    Rennes: ['rennes'],
    Grenoble: ['grenoble'],
    Brittany: ['bretagne', 'brittany'],
    Normandy: ['normandie', 'normandy'],
    Provence: ['provence'],
    Occitania: ['occitanie', 'occitania'],
    Corsica: ['corse', 'corsica'],
    Alsace: ['alsace'],
  },
}

// First draft: these word lists should be reviewed by a Spanish verifier.
const ES: CountryProfile = {
  code: 'ES',
  name: 'Spain',
  adjective: 'Spanish',
  flag: '🇪🇸',
  tlds: ['es'],
  rules: [
    { name: 'country', weight: 3, words: ['españa', 'espana', 'spain', 'espagne', 'spanje', 'spanien', 'espanya'] },
    { name: 'institution', weight: 2, words: ['csic', 'ucm', 'uam', 'upm', 'upf', 'uab', 'rtve', 'cadena ser'] },
    { name: 'nationality', weight: 1, words: ['español', 'española', 'españoles', 'espanol', 'espanola', 'spanish'] },
    {
      name: 'football',
      weight: 1,
      words: [
        'real madrid',
        'fc barcelona',
        'barça',
        'atlético de madrid',
        'atleti',
        'sevilla fc',
        'real betis',
        'athletic club',
        'real sociedad',
      ],
    },
  ],
  places: {
    Madrid: ['madrid'],
    Barcelona: ['barcelona'],
    Valencia: ['valencia', 'valència'],
    Seville: ['sevilla', 'seville'],
    Bilbao: ['bilbao'],
    Málaga: ['málaga', 'malaga'],
    Zaragoza: ['zaragoza'],
    Granada: ['granada'],
    Catalonia: ['catalunya', 'cataluña', 'catalonia'],
    'Basque Country': ['euskadi', 'país vasco', 'basque country'],
    Galicia: ['galicia'],
    Andalusia: ['andalucía', 'andalucia', 'andalusia'],
    Asturias: ['asturias'],
    'Canary Islands': ['canarias', 'canary islands'],
    Mallorca: ['mallorca', 'majorca'],
  },
}

// First draft: these word lists should be reviewed by a Dutch verifier.
// Brabant and Limburg are excluded (shared with Belgium), as are nos, rug and
// uva (common words in other languages).
const NL: CountryProfile = {
  code: 'NL',
  name: 'Netherlands',
  adjective: 'Dutch',
  flag: '🇳🇱',
  tlds: ['nl'],
  rules: [
    { name: 'country', weight: 3, words: ['nederland', 'netherlands', 'holland', 'pays-bas', 'niederlande', 'países bajos'] },
    {
      name: 'institution',
      weight: 2,
      words: [
        'tu delft',
        'tu/e',
        'universiteit van amsterdam',
        'universiteit leiden',
        'universiteit utrecht',
        'erasmus mc',
        'knaw',
        'tno',
        'vpro',
        'bnnvara',
        'rijksoverheid',
      ],
    },
    { name: 'nationality', weight: 1, words: ['nederlands', 'nederlandse', 'dutch', 'néerlandais'] },
    { name: 'football', weight: 1, words: ['ajax', 'psv', 'feyenoord', 'az alkmaar', 'fc twente', 'fc utrecht'] },
  ],
  places: {
    Amsterdam: ['amsterdam'],
    Rotterdam: ['rotterdam'],
    'The Hague': ['den haag', 'the hague', "'s-gravenhage"],
    Utrecht: ['utrecht'],
    Eindhoven: ['eindhoven'],
    Groningen: ['groningen'],
    Leiden: ['leiden'],
    Delft: ['delft'],
    Haarlem: ['haarlem'],
    Nijmegen: ['nijmegen'],
    Maastricht: ['maastricht'],
    Arnhem: ['arnhem'],
    Tilburg: ['tilburg'],
    Friesland: ['friesland', 'fryslân'],
    Zeeland: ['zeeland'],
  },
}

// First draft: these word lists should be reviewed by a Norwegian verifier.
const NO: CountryProfile = {
  code: 'NO',
  name: 'Norway',
  adjective: 'Norwegian',
  flag: '🇳🇴',
  tlds: ['no'],
  rules: [
    { name: 'country', weight: 3, words: ['norge', 'noreg', 'norway', 'norvège', 'noorwegen', 'norwegen', 'noruega'] },
    {
      name: 'institution',
      weight: 2,
      words: ['nrk', 'uio', 'ntnu', 'uib', 'sintef', 'stortinget', 'universitetet i oslo'],
    },
    { name: 'nationality', weight: 1, words: ['norsk', 'norske', 'norwegian', 'nordmann'] },
    { name: 'football', weight: 1, words: ['rosenborg', 'vålerenga', 'bodø/glimt', 'bodo/glimt', 'molde fk', 'sk brann'] },
  ],
  places: {
    Oslo: ['oslo'],
    Bergen: ['bergen'],
    Trondheim: ['trondheim'],
    Stavanger: ['stavanger'],
    Tromsø: ['tromsø', 'tromso'],
    Kristiansand: ['kristiansand'],
    Drammen: ['drammen'],
    Bodø: ['bodø', 'bodo'],
    Ålesund: ['ålesund', 'aalesund'],
    Lofoten: ['lofoten'],
    Svalbard: ['svalbard'],
    Finnmark: ['finnmark'],
  },
}

export const PROFILES: Record<string, CountryProfile> = { BE, IT, FR, ES, NL, NO }

// Curated profile when we have local lists, else the generic flag + domain +
// country-name fallback for any ISO 3166-1 country; null for anything else.
export function profileFor(code: string | null | undefined): CountryProfile | null {
  if (!code) return null
  const upper = code.toUpperCase()
  return PROFILES[upper] ?? genericCountryProfile(upper) ?? null
}

/**
 * The org's ranking profile: its country profile (if any) plus its own signal
 * words (if any). Rules and handle domains are concatenated so scores add up;
 * flag and places come from the country. Null when the org has neither.
 */
export function buildOrgProfile({
  country,
  signalTerms,
}: {
  country: string | null
  signalTerms: string[]
}): SignalProfile | null {
  const base = profileFor(country)
  const custom = customProfile(signalTerms)
  if (!custom) return base
  if (!base) return custom
  return {
    code: base.code,
    name: base.name,
    adjective: base.adjective,
    flag: base.flag,
    tlds: [...base.tlds, ...custom.tlds],
    rules: [...base.rules, ...custom.rules],
    places: base.places,
  }
}
