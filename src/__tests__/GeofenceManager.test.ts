import { isAtAnyKnownLocation } from '../detection/GeofenceManager';
import { KnownLocation } from '../storage/types';

describe('GeofenceManager', () => {
  describe('isAtAnyKnownLocation', () => {
    const mockLocations: KnownLocation[] = [
      {
        id: 1,
        label: 'Home',
        latitude: 52.37,
        longitude: 4.89,
        radiusMeters: 100,
        isIndoor: true,
        status: 'active',
      },
      {
        id: 2,
        label: 'Park',
        latitude: 52.38,
        longitude: 4.9,
        radiusMeters: 200,
        isIndoor: false,
        status: 'active',
      },
    ];

    it('should return true if coordinates are within a location radius', () => {
      // Home center
      expect(isAtAnyKnownLocation(52.37, 4.89, mockLocations)).toBe(true);
      // Home edge (approx 50m away)
      expect(isAtAnyKnownLocation(52.3705, 4.8905, mockLocations)).toBe(true);
    });

    it('should return false if coordinates are outside all location radii', () => {
      // Somewhere far away
      expect(isAtAnyKnownLocation(53.0, 5.0, mockLocations)).toBe(false);
    });

    it('should return false if the location list is empty', () => {
      expect(isAtAnyKnownLocation(52.37, 4.89, [])).toBe(false);
    });
  });
});
