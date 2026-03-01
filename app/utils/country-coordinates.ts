// Map of country codes to approximate center coordinates [lat, long]
export const countryCoordinates: Record<string, [number, number]> = {
  US: [39.8283, -98.5795], // United States
  CA: [56.1304, -106.3468], // Canada
  GB: [55.3781, -3.4360], // United Kingdom
  DE: [51.1657, 10.4515], // Germany
  FR: [46.2276, 2.2137], // France
  ES: [40.4637, -3.7492], // Spain
  IT: [41.8719, 12.5674], // Italy
  NL: [52.1326, 5.2913], // Netherlands
  BE: [50.5039, 4.4699], // Belgium
  CH: [46.8182, 8.2275], // Switzerland
  AT: [47.5162, 14.5501], // Austria
  DK: [56.2639, 9.5018], // Denmark
  SE: [60.1282, 18.6435], // Sweden
  NO: [60.4720, 8.4689], // Norway
  FI: [61.9241, 25.7482], // Finland
  PL: [51.9194, 19.1451], // Poland
  CZ: [49.8175, 15.4730], // Czech Republic
  AU: [-25.2744, 133.7751], // Australia
  NZ: [-40.9006, 174.8860], // New Zealand
  JP: [36.2048, 138.2529], // Japan
  CN: [35.8617, 104.1954], // China
  IN: [20.5937, 78.9629], // India
  BR: [-14.2350, -51.9253], // Brazil
  MX: [23.6345, -102.5528], // Mexico
  AR: [-38.4161, -63.6167], // Argentina
  ZA: [-30.5595, 22.9375], // South Africa
  RU: [61.5240, 105.3188], // Russia
  KR: [35.9078, 127.7669], // South Korea
  SG: [1.3521, 103.8198], // Singapore
  IE: [53.4129, -8.2439], // Ireland
  PT: [39.3999, -8.2245], // Portugal
  GR: [39.0742, 21.8243], // Greece
  HU: [47.1625, 19.5033], // Hungary
  RO: [45.9432, 24.9668], // Romania
  TR: [38.9637, 35.2433], // Turkey
  IL: [31.0461, 34.8516], // Israel
  EG: [26.8206, 30.8025], // Egypt
  TH: [15.8700, 100.9925], // Thailand
  VN: [14.0583, 108.2772], // Vietnam
  PH: [12.8797, 121.7740], // Philippines
  ID: [-0.7893, 113.9213], // Indonesia
  MY: [4.2105, 101.9758], // Malaysia
  CL: [-35.6751, -71.5430], // Chile
  CO: [4.5709, -74.2973], // Colombia
  PE: [-9.1900, -75.0152], // Peru
  UY: [-32.5228, -55.7658], // Uruguay
};

/**
 * Get coordinates for a country code (ISO 3166-1 alpha-2)
 * Returns null if country not found
 */
export function getCountryCoordinates(countryCode: string): [number, number] | null {
  const code = countryCode.toUpperCase();
  return countryCoordinates[code] || null;
}
