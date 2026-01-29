const intelligenceService = require('../services/intelligenceService');

describe('Intelligence Service', () => {
  describe('detectWeightStagnation', () => {
    it('should detect stagnation with <0.5kg variance over 14 days', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-15'), peso: 75.0 },
        { fecha: new Date('2026-01-22'), peso: 75.2 },
        { fecha: new Date('2026-01-29'), peso: 75.1 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).not.toBeNull();
      expect(result.type).toBe('weight_stagnation');
      expect(result.severity).toBe('medium');
      expect(result.data.variance).toBeLessThan(0.5);
    });

    it('should return null when variance is >0.5kg', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-15'), peso: 75.0 },
        { fecha: new Date('2026-01-22'), peso: 75.6 },
        { fecha: new Date('2026-01-29'), peso: 76.0 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).toBeNull();
    });

    it('should return null with insufficient data', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-29'), peso: 75.0 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).toBeNull();
    });

    it('should set severity to high after 21 days', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-01'), peso: 75.0 },
        { fecha: new Date('2026-01-08'), peso: 75.1 },
        { fecha: new Date('2026-01-15'), peso: 75.2 },
        { fecha: new Date('2026-01-22'), peso: 75.1 },
        { fecha: new Date('2026-01-29'), peso: 75.0 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).not.toBeNull();
      expect(result.severity).toBe('high');
    });

    it('should return null when no peso data', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-15') },
        { fecha: new Date('2026-01-22') },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).toBeNull();
    });
  });

  describe('analyzeGamificationEngagement', () => {
    it('should detect low engagement after 7 days of inactivity', () => {
      const gamification = {
        currentStreak: 0,
        lastActivityDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        points: 500,
      };

      const result = intelligenceService.analyzeGamificationEngagement(gamification);

      expect(result).not.toBeNull();
      expect(result.type).toBe('low_engagement');
      expect(result.severity).toBe('medium');
    });

    it('should set severity to high after 14 days of inactivity', () => {
      const gamification = {
        currentStreak: 0,
        lastActivityDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        points: 500,
      };

      const result = intelligenceService.analyzeGamificationEngagement(gamification);

      expect(result).not.toBeNull();
      expect(result.severity).toBe('high');
    });

    it('should return null for recent activity', () => {
      const gamification = {
        currentStreak: 5,
        lastActivityDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        points: 500,
      };

      const result = intelligenceService.analyzeGamificationEngagement(gamification);

      expect(result).toBeNull();
    });

    it('should return null when no gamification data', () => {
      const result = intelligenceService.analyzeGamificationEngagement(null);

      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty progress history', () => {
      const result = intelligenceService.detectWeightStagnation([]);
      expect(result).toBeNull();
    });

    it('should handle null progress history', () => {
      const result = intelligenceService.detectWeightStagnation(null);
      expect(result).toBeNull();
    });

    it('should handle undefined progress history', () => {
      const result = intelligenceService.detectWeightStagnation(undefined);
      expect(result).toBeNull();
    });

    it('should handle gamification with missing lastActivityDate', () => {
      const gamification = {
        currentStreak: 5,
        points: 500,
      };

      const result = intelligenceService.analyzeGamificationEngagement(gamification);

      expect(result).toBeNull();
    });
  });

  describe('Data Validation', () => {
    it('should handle progress entries with invalid dates', () => {
      const progressHistory = [
        { fecha: 'invalid-date', peso: 75.0 },
        { fecha: new Date('2026-01-22'), peso: 75.2 },
      ];

      // Should not throw error
      expect(() => {
        intelligenceService.detectWeightStagnation(progressHistory);
      }).not.toThrow();
    });

    it('should handle negative weight values', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-15'), peso: -75.0 },
        { fecha: new Date('2026-01-22'), peso: -75.2 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      // Should still process the data
      expect(result).toBeDefined();
    });

    it('should handle very large weight values', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-15'), peso: 500.0 },
        { fecha: new Date('2026-01-22'), peso: 500.2 },
        { fecha: new Date('2026-01-29'), peso: 500.1 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).not.toBeNull();
      expect(result.type).toBe('weight_stagnation');
    });
  });

  describe('Calculation Accuracy', () => {
    it('should calculate variance correctly', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-15'), peso: 75.0 },
        { fecha: new Date('2026-01-22'), peso: 75.3 },
        { fecha: new Date('2026-01-29'), peso: 75.1 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).not.toBeNull();
      expect(result.data.variance).toBeCloseTo(0.3, 1);
    });

    it('should calculate days stagnant correctly', () => {
      const today = new Date();
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(today.getDate() - 14);

      const progressHistory = [
        { fecha: fourteenDaysAgo, peso: 75.0 },
        { fecha: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), peso: 75.2 },
        { fecha: today, peso: 75.1 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).not.toBeNull();
      expect(result.data.daysStagnant).toBeGreaterThanOrEqual(14);
    });
  });

  describe('Recommendation Quality', () => {
    it('should provide actionable recommendations', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-15'), peso: 75.0 },
        { fecha: new Date('2026-01-22'), peso: 75.2 },
        { fecha: new Date('2026-01-29'), peso: 75.1 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).not.toBeNull();
      expect(result.actionable).toBe(true);
      expect(result.suggestedActions).toBeDefined();
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should include specific numeric recommendations', () => {
      const progressHistory = [
        { fecha: new Date('2026-01-15'), peso: 75.0 },
        { fecha: new Date('2026-01-22'), peso: 75.2 },
        { fecha: new Date('2026-01-29'), peso: 75.1 },
      ];

      const result = intelligenceService.detectWeightStagnation(progressHistory);

      expect(result).not.toBeNull();
      expect(result.recommendation).toContain('200-300');
    });
  });
});
